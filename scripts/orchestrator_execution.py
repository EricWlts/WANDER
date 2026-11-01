"""Explicit, serial execution of content-addressed plans. No automatic adoption."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import uuid

import orchestrator_planning as planning


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()


def storage_path(runtime):
    storage = runtime.ROOT / "artifacts" / "orchestrator"
    for path in (storage.parent, storage, storage / "runner.lock"):
        if path.is_symlink():
            raise runtime.Stop("Unsicherer Laufzeitpfad.")
    return storage


def save_plan(storage, request, value, files, runtime):
    """The ID seals all execution inputs; existing IDs are never overwritten."""
    storage_path(runtime)
    value = planning.validate_plan(value, files, runtime)
    payload = {"version": planning.VERSION, "request": request, "source": files,
               "plan": value, "proposed": planning.decorate(value, request, runtime)}
    data = encoded(payload)
    plan_id = "validated-" + hashlib.sha256(data).hexdigest()
    target = storage / plan_id
    if target.is_symlink():
        raise runtime.Stop("Unsicherer Planpfad.")
    target.mkdir(parents=True, exist_ok=True)
    path = target / "validated-plan.json"
    if path.is_symlink():
        raise runtime.Stop("Unsicherer Planpfad.")
    if path.exists():
        if path.read_bytes() != data:
            raise runtime.Stop("Gespeicherter Plan wurde manipuliert.")
    else:
        with path.open("xb") as output:
            output.write(data)
    return plan_id


def load_plan(plan_id, runtime, execution=True):
    if not re.fullmatch(r"validated-[0-9a-f]{64}", plan_id):
        raise runtime.Stop("Ausführbarer Plan benötigt eine gültige neue Plan-ID; alte Pläne erneut analysieren.")
    path = storage_path(runtime) / plan_id / "validated-plan.json"
    if path.parent.is_symlink() or path.is_symlink():
        raise runtime.Stop("Unsicherer Planpfad.")
    try:
        raw = path.read_bytes()
        if len(raw) > 1000000 or hashlib.sha256(raw).hexdigest() != plan_id[10:]:
            raise runtime.Stop("Planinhalt manipuliert oder ungültig.")
        payload = json.loads(raw)
        if (set(payload) != {"version", "request", "source", "plan", "proposed"}
                or payload["version"] != planning.VERSION
                or type(payload["request"]) is not str or not payload["request"].strip()):
            raise runtime.Stop("Veraltetes oder ungültiges Planformat.")
        files = planning.inventory(runtime)
        if payload["source"] != files:
            raise runtime.Stop("Veralteter Plan: Projektstand hat sich verändert.")
        value = planning.validate_plan(payload["plan"], files, runtime)
        if execution and ("unclear" in value["flags"] or "architecture" in value["flags"]):
            raise runtime.Stop("Offene Anforderungen/Architektur benötigen manuelle Klärung.")
        # Re-run deterministic routing; never execute a persisted prompt/model blindly.
        proposed = planning.decorate(value, payload["request"], runtime)
        if proposed != payload["proposed"]:
            raise runtime.Stop("Modellrouting hat sich verändert; Plan erneut erstellen.")
        for task in value["tasks"]:
            if execution:
                runtime.route(payload["request"] + " " + json.dumps(task, ensure_ascii=False))
            for name in task["paths"]:
                if name not in files and (runtime.ROOT / name).exists():
                    raise runtime.Stop("Neue Zieldatei existiert bereits unversioniert: " + name)
        return payload, proposed
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise runtime.Stop("Gespeicherter Plan fehlt oder ist ungültig.") from exc


def execute_plan(args, runtime):
    if (runtime.os.name != "posix" or not 1 <= args.timeout <= 3600
            or not 1 <= args.worker_calls <= 16 or args.max_tokens < 1):
        raise runtime.Stop("Ungültige Plattform, Timeout oder Ausführungsbudget.")
    storage = storage_path(runtime)
    payload, proposed = load_plan(args.execute_plan, runtime)
    allowed = sorted({p for task in proposed["tasks"] for p in task["paths"]})
    preview = [{k: task[k] for k in ("id", "goal", "paths", "read_paths", "depends_on",
                                    "model", "reasoning", "routing_reason", "checks")}
               for task in proposed["tasks"]]
    print(json.dumps({"plan_id": args.execute_plan, "tasks": preview,
                      "all_target_files": allowed, "worker_calls": args.worker_calls,
                      "max_observed_tokens": args.max_tokens, "hard_cost_limit": False,
                      "manual_adoption_required": True}, ensure_ascii=False, indent=2))
    if args.dry_run:
        return 0
    for binary in ("codex", "git", "npm"):
        if runtime.shutil.which(binary) is None:
            raise runtime.Stop("Programm fehlt: " + binary)
    planning.check_cli(runtime)
    with (storage / "runner.lock").open("a") as lock:
        try:
            runtime.fcntl.flock(lock, runtime.fcntl.LOCK_EX | runtime.fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise runtime.Stop("Ein Orchestrator läuft bereits.") from exc
        if not runtime.sys.stdin.isatty() or input(
                "Alle angezeigten Zieldateien und Modelle nur in isolierter Kopie freigeben? EXECUTE eingeben: ") != "EXECUTE":
            raise runtime.Stop("Zusammengefasste Schreibfreigabe nicht erteilt.")
        # The user may have left the confirmation open while editing the project/plan.
        payload, proposed = load_plan(args.execute_plan, runtime)
        return execute_locked(args, runtime, storage, payload, proposed, allowed)


def execute_locked(args, runtime, storage, payload, proposed, allowed):
    run = storage / (time.strftime("%Y%m%d-%H%M%S-exec-") + uuid.uuid4().hex[:8])
    workspace = run / "workspace"
    workspace.mkdir(parents=True)
    baseline = payload["source"]
    report = {"status": "stopped", "plan_id": args.execute_plan, "allowed": allowed,
              "base_hashes": baseline, "files": [], "calls": [], "checks": [],
              "manual_checks": [], "completed_tasks": [], "write_approval": allowed,
              "review": "Isolierte Ergebnisse; manuelles Review und APPLY erforderlich."}
    budget = planning.Budget(args.worker_calls, args.max_tokens, runtime.Stop)
    original_status = None

    def original_unchanged():
        if planning.inventory(runtime) != baseline or subprocess.run(
                ["git", "status", "--porcelain", "-uall"], cwd=runtime.ROOT,
                check=True, capture_output=True).stdout != original_status:
            raise runtime.Stop("Originalprojekt während Ausführung verändert.")

    try:
        original_status = subprocess.run(["git", "status", "--porcelain", "-uall"],
                                         cwd=runtime.ROOT, check=True, capture_output=True).stdout
        original_unchanged()
        for name in baseline:
            target = workspace / name
            target.parent.mkdir(parents=True, exist_ok=True)
            runtime.shutil.copy2(runtime.ROOT / name, target)
        if runtime.snapshot(workspace) != baseline:
            raise runtime.Stop("Projektstand während Kopie verändert.")
        if runtime.run_process(["git", "init", "--quiet", str(workspace)], runtime.ROOT, 30, run / "init.log"):
            raise runtime.Stop("Isoliertes Git-Verzeichnis fehlt.")
        schema = run / "schema.json"
        schema.write_text(json.dumps(runtime.SCHEMA))
        dependencies = set()
        checkspace = run / "check-workspace"
        checkspace.mkdir()
        for task in proposed["tasks"]:
            if not set(task["depends_on"]) <= set(report["completed_tasks"]):
                raise runtime.Stop("Abhängigkeit noch nicht erfolgreich geprüft.")
            task_base = runtime.snapshot(workspace)
            followup = ""
            for attempt in range(2):  # At most one explicit worker-requested repair, no model escalation.
                budget.admit()
                index = len(report["calls"])
                answer, log = run / f"{index}-answer.json", run / f"{index}-worker.log"
                entry = {"task": task["id"], "model": task["model"], "reasoning": task["reasoning"]}
                report["calls"].append(entry)
                contract = {k: task[k] for k in planning.TASK["properties"]}
                prompt = ("Eine Aufgabe in isolierter Kopie. AGENTS.md/ARCHITECTURE.md beachten; "
                          "nur relevante Dateien lesen. Nur paths sind ausdrücklich schreibfreigegeben. "
                          "Keine Tests/Builds (Runner prüft), Installationen, Secrets, Git-Änderungen, "
                          "Commits, Pushes, Deployments, Netzwerk oder weitere Agenten. "
                          "Bei Unsicherheit blocked. Vertrag:\n"
                          + json.dumps(contract, ensure_ascii=False, separators=(",", ":")) + followup)
                try:
                    code = runtime.run_process(runtime.worker_command(
                        workspace, (task["model"], task["reasoning"]), schema, answer),
                        workspace, args.timeout, log, prompt)
                finally:
                    entry["usage"] = runtime.usage_from_log(log)
                    budget.record(entry["usage"])
                    report["budget"] = budget.report()
                    current = runtime.snapshot(workspace)
                    report["files"] = runtime.changes(baseline, current)
                unexpected = set(runtime.changes(task_base, current)) - set(task["paths"])
                if unexpected:
                    raise runtime.Stop("Unerwartete Dateiänderungen: " + ", ".join(sorted(unexpected)))
                original_unchanged()
                if code:
                    raise runtime.Stop("Worker fehlgeschlagen; keine Fortsetzung.")
                result = runtime.validate_answer(answer)
                entry["result"] = result
                if result["status"] == "complete":
                    if not runtime.changes(task_base, current):
                        raise runtime.Stop("Keine Änderungen; Ergebnis unklar.")
                    break
                if result["status"] != "needs_repair" or attempt == 1:
                    raise runtime.Stop("Worker gestoppt: " + result["summary"])
                followup = "\nEinziger Reparaturversuch: " + result["summary"]
            candidate = runtime.snapshot(workspace)
            # Coding workers never see installed dependencies or generated test output.
            # Reuse dependencies in a separate check copy, synchronizing only source files.
            for name in set(runtime.snapshot(checkspace)) - set(candidate):
                (checkspace / name).unlink()
            for name in candidate:
                target = checkspace / name
                target.parent.mkdir(parents=True, exist_ok=True)
                runtime.shutil.copy2(workspace / name, target)
            commands = runtime.check_plan(task["paths"])
            if "backend" in task["checks"] and ["npm", "test"] not in commands:
                commands.append(["npm", "test"])
            for dependency in ("node_modules", ".venv"):
                if dependency in dependencies or (dependency == ".venv" and ["npm", "test"] not in commands):
                    continue
                source = runtime.ROOT / dependency
                if not source.is_dir():
                    raise runtime.Stop("Installierte Abhängigkeiten fehlen: " + dependency)
                if dependency == "node_modules":
                    runtime.copy_node_modules(source, checkspace / dependency)
                else:
                    runtime.shutil.copytree(source, checkspace / dependency, symlinks=False)
                    runtime.validate_backend_venv(checkspace / dependency)
                dependencies.add(dependency)
            for command in commands:
                item = {"task": task["id"], "command": command, "status": "running"}
                report["checks"].append(item)
                code = runtime.run_process(command, checkspace, args.timeout,
                                           run / f"{len(report['checks'])}-check.log")
                item["status"] = "passed" if code == 0 else "failed"
                if code:
                    raise runtime.Stop("Prüfung fehlgeschlagen: " + " ".join(command))
                if runtime.snapshot(checkspace, checking=True) != candidate:
                    raise runtime.Stop("Prüfung änderte unerwartete Dateien.")
                original_unchanged()
            if "manual" in task["checks"]:
                report["manual_checks"].append({"task": task["id"], "status": "pending"})
            report["completed_tasks"].append(task["id"])
        original_unchanged()
        report["status"] = "ready_for_manual_review"
        return 0
    except (runtime.Stop, OSError, subprocess.SubprocessError, KeyboardInterrupt) as exc:
        report["error"] = str(exc) or "Unterbrochen"
        print("STOP: " + report["error"], file=runtime.sys.stderr)
        return 1
    finally:
        (run / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print("Review-Bericht: " + str(run / "report.json"))
