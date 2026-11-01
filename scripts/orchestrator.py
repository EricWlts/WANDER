"""Serial, review-only Codex runner. Python standard library; POSIX only."""
import argparse
import difflib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
SOL = ("gpt-6.1-sol", "medium")
LUNA = ("gpt-6-luna", "medium")
RULES = ("AGENTS.md", "ARCHITECTURE.md", "TASKS.md")
SCHEMA = {"type": "object", "properties": {
    "status": {"type": "string", "enum": ["complete", "needs_repair", "needs_sol", "blocked"]},
    "summary": {"type": "string"}}, "required": ["status", "summary"],
    "additionalProperties": False}


class Stop(RuntimeError):
    pass


def route(task):
    """Risk rules win over cheap keywords; unknown tasks default to Luna medium."""
    text = task.casefold()
    if re.search(r"\bastra\b|mehrbenutzer|multi.?user|cloud.?hosting|betriebsmodell|systemwechsel|grundlegende.*architektur", text):
        raise Stop("Architekturentscheidung: manuell klären; Astra wird nie gestartet.")
    if re.search(r"\bsol\b|\bt7\b|recovery|wiederherstell|autosave|merge|race|concurren|gekoppelt|composition|published_data|veröffentlich|auth|csrf|migration|datenbank|database|backend/", text):
        return SOL
    if re.search(r"\bt[46]\b|luna_low|tippfehler|typo|rechtschreib|dokumentation|readme|nur.*tests|tests.*ergänzen", text):
        return ("gpt-6-luna", "low")
    return LUNA


def safe_path(name):
    path = Path(name)
    parts = [p.casefold() for p in path.parts]
    forbidden = {".git", ".codex", ".agents", ".aws", ".ssh", ".instance",
                 "node_modules", ".venv", "dist", "artifacts", "__pycache__", ".pytest_cache"}
    if (not parts or path.is_absolute() or ".." in parts
            or any(p in forbidden or p.startswith(".env") for p in parts)
            or any(re.search(r"secret|credential|token|password|private.?key|^id_rsa|\.(pem|key|p12|sqlite|db)$", p) for p in parts)):
        raise Stop("Unzulässiger Pfad: " + name)
    return path.as_posix()


def run_process(command, cwd, timeout, log, prompt=None):
    """Always reap the process group, including children surviving their parent."""
    with log.open("wb") as output:
        process = subprocess.Popen(command, cwd=cwd, stdin=subprocess.PIPE if prompt else subprocess.DEVNULL,
                                   stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            process.communicate(prompt.encode() if prompt else None, timeout=timeout)
            return process.returncode
        except subprocess.TimeoutExpired as exc:
            raise Stop("Timeout: " + command[0]) from exc
        finally:
            # SIGKILL avoids a grace period in which descendants could continue writing.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()


SNAPSHOT_IGNORED_DIRS = {".git", "node_modules", ".venv", "dist", "artifacts", "__pycache__", ".pytest_cache"}
SNAPSHOT_IGNORED_FILES = {".DS_Store"}
SNAPSHOT_IGNORED_SUFFIXES = (".tsbuildinfo", ".pyc")


def snapshot(root, checking=False):
    """Hash project files, consistently excluding copied dependencies and generated output."""
    result = {}
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SNAPSHOT_IGNORED_DIRS]
        for name in list(dirs) + files:
            if name in SNAPSHOT_IGNORED_FILES or name.endswith(SNAPSHOT_IGNORED_SUFFIXES):
                continue
            path = Path(folder) / name
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                raise Stop("Symlink im Prüfbereich: " + relative)
            if path.is_file():
                result[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def copy_node_modules(source, target):
    """Copy installed packages while preserving only links contained in the tree."""
    source_root = source.resolve()
    for folder, dirs, files in os.walk(source, followlinks=False):
        for name in list(dirs) + files:
            path = Path(folder) / name
            if not path.is_symlink():
                continue
            link = os.readlink(path)
            if Path(link).is_absolute():
                raise Stop("Absoluter Symlink in node_modules: " + path.relative_to(source).as_posix())
            try:
                (path.parent / link).resolve().relative_to(source_root)
            except (OSError, RuntimeError, ValueError) as exc:
                raise Stop("Symlinkziel außerhalb von node_modules: " + path.relative_to(source).as_posix()) from exc
    shutil.copytree(source, target, symlinks=True)


def validate_backend_venv(venv):
    """Require a usable copied environment without installing or reaching into source."""
    python = venv / "bin" / "python"
    if not python.is_file() or not os.access(python, os.X_OK):
        raise Stop("Backend-Tests gestoppt: Die isolierte .venv enthält keinen ausführbaren bin/python-Interpreter.")
    for args in (("--version",), ("-m", "pytest", "--version")):
        try:
            result = subprocess.run([str(python), *args], cwd=venv.parent,
                                    capture_output=True, timeout=15, check=False)
        except (OSError, subprocess.SubprocessError) as exc:
            raise Stop("Backend-Tests gestoppt: Die kopierte .venv ist nicht ausführbar; Umgebung lokal neu erstellen.") from exc
        if result.returncode:
            raise Stop("Backend-Tests gestoppt: Die kopierte .venv ist unvollständig (Python oder pytest fehlt); "
                       "bitte .venv im Originalprojekt kontrolliert neu erstellen. Es wurden keine Pakete installiert.")


def changes(before, after):
    return sorted(p for p in before.keys() | after.keys()
                  if Path(p).name != ".DS_Store" and before.get(p) != after.get(p))


def worker_command(workspace, model, schema, answer):
    return ["codex", "--no-daemon", "exec", "--json", "--ignore-user-config", "--ephemeral",
            "--sandbox", "workspace-write", "--model", model[0],
            "-c", 'model_reasoning_effort="' + model[1] + '"',
            "-c", 'approval_policy="never"', "-c", "features.multi_agent=false",
            "-c", "sandbox_workspace_write.network_access=false",
            "-c", "sandbox_workspace_write.exclude_tmpdir_env_var=true",
            "-c", "sandbox_workspace_write.exclude_slash_tmp=true",
            "--cd", str(workspace), "--output-schema", str(schema),
            "--output-last-message", str(answer), "-"]


def confirm_sol():
    if not sys.stdin.isatty() or input("Höheres Modell gpt-6.1-sol / medium verwenden? Tippe SOL: ") != "SOL":
        raise Stop("Sol nicht manuell bestätigt.")


def validate_answer(answer):
    try:
        value = json.loads(answer.read_text())
    except (OSError, ValueError) as exc:
        raise Stop("Fehlendes oder unlesbares Worker-Ergebnis.") from exc
    if (not isinstance(value, dict) or set(value) != {"status", "summary"}
            or value["status"] not in SCHEMA["properties"]["status"]["enum"]
            or not isinstance(value["summary"], str) or not value["summary"].strip()):
        raise Stop("Unklares Worker-Ergebnis.")
    return value


def usage_from_log(path):
    """Read Codex JSONL token usage events; unavailable fields stay explicitly unknown."""
    usage = {"input_tokens": "unknown", "output_tokens": "unknown", "total_tokens": "unknown",
             "cached_input_tokens": "unknown", "reasoning_output_tokens": "unknown"}
    try:
        events = []
        for line in path.read_text(errors="replace").splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if isinstance(event, dict):
                events.append(event)
        # Codex reports per-turn usage. Prefer these over response events to avoid
        # counting the same response twice if both event families are present.
        turns = [e for e in events if e.get("type") == "turn.completed"]
        completed = turns or [e for e in events if e.get("type") == "response.completed"]
        counts = {key: [] for key in usage}
        for event in completed:
            response = event.get("response")
            info = event.get("usage") or (response.get("usage") if isinstance(response, dict) else {})
            info = info if isinstance(info, dict) else {}
            values = dict(info)
            for field, details_field, nested in (
                    ("cached_input_tokens", "input_tokens_details", "cached_tokens"),
                    ("reasoning_output_tokens", "output_tokens_details", "reasoning_tokens")):
                details = info.get(details_field)
                if field not in values and isinstance(details, dict):
                    values[field] = details.get(nested)
            for key in counts:
                value = values.get(key)
                counts[key].append(value if type(value) is int and value >= 0 else None)
        for key, values in counts.items():
            if values and all(value is not None for value in values):
                usage[key] = sum(values)
    except OSError:
        pass
    return usage


def review_run(run, apply=False, selected=None, input_fn=None):
    report_path = run / "report.json"
    try:
        report = json.loads(report_path.read_text())
    except (OSError, ValueError) as exc:
        raise Stop("Laufbericht fehlt oder ist ungültig.") from exc
    if not isinstance(report, dict) or report.get("status") != "ready_for_manual_review":
        raise Stop("Lauf ist nicht zur Übernahme freigegeben.")
    workspace = run / "workspace"
    try:
        raw_allow, raw_changed = report.get("allowed"), report.get("files")
        base = report.get("base_hashes")
        if (not isinstance(raw_allow, list) or not raw_allow
                or not isinstance(raw_changed, list) or not raw_changed
                or not isinstance(base, dict) or not base):
            raise Stop("Alter oder unvollständiger Laufbericht: Basis-Hashes oder erlaubte Pfade fehlen.")
        allow = {safe_path(p) for p in raw_allow}
        changed = {safe_path(p) for p in raw_changed}
        selected = None if selected is None else {safe_path(p) for p in selected}
    except (Stop, TypeError) as exc:
        if isinstance(exc, Stop) and str(exc).startswith("Alter oder"):
            raise
        raise Stop("Ungültige Pfadangaben im Laufbericht.") from exc
    if (len(allow) != len(raw_allow) or len(changed) != len(raw_changed)
            or not changed <= allow
            or any(not isinstance(p, str) for p in base)
            or any(not isinstance(p, str) or not re.fullmatch(r"[0-9a-f]{64}", h)
                   for p, h in base.items())):
        raise Stop("Laufbericht enthält unvollständige oder inkonsistente Basisdaten.")
    try:
        invalid_base_path = any(safe_path(p) != p for p in base)
    except (Stop, TypeError):
        invalid_base_path = True
    if invalid_base_path:
        raise Stop("Ungültiger Basispfad im Laufbericht.")
    current = snapshot(workspace)
    if set(changes(base, current)) != changed:
        raise Stop("Projektkopie wurde nach dem Lauf unerwartet verändert.")
    paths = sorted(changed if selected is None else set(selected))
    if not paths or any(p not in allow or p not in changed for p in paths):
        raise Stop("Review/Apply enthält nicht freigegebene oder unveränderte Dateien.")
    for path in paths:
        original = ROOT / path
        if any(part.is_symlink() for part in (ROOT.joinpath(*Path(path).parts[:i])
                                                for i in range(1, len(Path(path).parts) + 1))):
            raise Stop("Symlink im Übernahmepfad: " + path)
        actual = hashlib.sha256(original.read_bytes()).hexdigest() if original.is_file() else None
        if actual != base.get(path):
            raise Stop("Konflikt: Originaldatei seit dem Lauf verändert: " + path)
    for path in paths:
        print("".join(difflib.unified_diff(
            ((ROOT / path).read_text(errors="replace") if base.get(path) and (ROOT / path).is_file() else "").splitlines(True),
            ((workspace / path).read_text(errors="replace") if (workspace / path).is_file() else "").splitlines(True),
            fromfile="original/" + path, tofile="copy/" + path)), end="")
    if not apply:
        return
    for path in paths:
        original = ROOT / path
        if any(part.is_symlink() for part in (ROOT.joinpath(*Path(path).parts[:i])
                                                for i in range(1, len(Path(path).parts) + 1))):
            raise Stop("Symlink im Übernahmepfad: " + path)
    if input_fn is None and not sys.stdin.isatty():
        raise Stop("Übernahme erfordert eine interaktive Bestätigung.")
    confirm = input_fn or input
    if confirm("Zur Übernahme aller angezeigten Änderungen APPLY eingeben: ") != "APPLY":
        raise Stop("Übernahme nicht bestätigt.")
    for path in paths:
        source, target = workspace / path, ROOT / path
        if source.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
        elif target.exists():
            target.unlink()


def check_plan(paths):
    commands = [["npm", "run", "test:frontend"], ["npm", "run", "build"]]
    if any(p.startswith("backend/") or p in {"package.json", "package-lock.json"} for p in paths):
        commands.append(["npm", "test"])
    return commands


def execute(args, model, allowed, rules):
    if os.name != "posix":
        raise Stop("Nur POSIX unterstützt: Prozessgruppen-Abbruch erforderlich.")
    for binary in ("codex", "git", "npm"):
        if shutil.which(binary) is None:
            raise Stop("Programm fehlt: " + binary)
    # Runtime data lives in the ignored artifacts directory, inside this project.
    storage = ROOT / "artifacts" / "orchestrator"
    for path in (ROOT / "artifacts", storage):
        if path.is_symlink():
            raise Stop("Unsicherer Laufzeitpfad.")
    storage.mkdir(parents=True, exist_ok=True)
    with (storage / "runner.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise Stop("Ein Orchestrator läuft bereits.") from exc
        return execute_locked(args, model, allowed, rules, storage)


def execute_locked(args, model, allowed, rules, storage):
    run = storage / (time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8])
    run.mkdir()
    workspace = run / "workspace"
    workspace.mkdir()
    report = {"status": "stopped", "calls": [], "checks": [], "files": [], "allowed": allowed,
              "review": "Nur Projektkopie; manuelles Review und manuelle Übernahme erforderlich."}
    try:
        # Never include untracked data, secrets, live DBs or user Codex configuration.
        listed = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True,
                                capture_output=True).stdout.decode().split("\0")
        source = {}
        original_status = subprocess.run(["git", "status", "--porcelain", "-uall"], cwd=ROOT,
                                         check=True, capture_output=True).stdout
        for name in filter(None, listed):
            try:
                safe_path(name)
            except Stop:
                continue
            path = ROOT / name
            if any((ROOT.joinpath(*Path(name).parts[:i])).is_symlink()
                   for i in range(1, len(Path(name).parts) + 1)):
                raise Stop("Symlink in Quelldateien: " + name)
            if not path.is_file():
                raise Stop("Quelldatei fehlt: " + name)
            source[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            target = workspace / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
        if not all((workspace / name).is_file() for name in RULES):
            raise Stop("Projektregeln müssen in Git erfasst sein.")
        if run_process(["git", "init", "--quiet", str(workspace)], ROOT, 30, run / "init.log"):
            raise Stop("Isoliertes Git-Verzeichnis konnte nicht angelegt werden.")
        baseline = snapshot(workspace)
        report["base_hashes"] = baseline
        schema = run / "schema.json"
        schema.write_text(json.dumps(SCHEMA))
        repair_used = False
        sol_used = model == SOL
        followup = ""
        for attempt in range(3):
            if model == SOL:
                confirm_sol()
            answer = run / (str(attempt) + "-answer.json")
            prompt = ("Bearbeite ausschließlich diese eine Aufgabe in der aktuellen Projektkopie. "
                      "Lies AGENTS.md, ARCHITECTURE.md und den passenden TASKS.md-Eintrag. "
                      "Bei Architekturentscheidungen oder Unsicherheit status blocked. "
                      "Keine weiteren Agenten/KI-Aufrufe, keine Abhängigkeiten installieren, keine Tests "
                      "oder Builds starten (der Orchestrator prüft), keine Commits/Pushes/Deployments. "
                      "Keine Secrets, .env, Umgebungsvariablen, Git-Metadaten oder Dateien außerhalb "
                      "dieser Kopie bearbeiten. Nur folgende Dateien dürfen geändert werden: "
                      + json.dumps(allowed) + "\nProjektregeln:\n" + rules
                      + "\nAufgabe:\n" + args.task + "\n" + followup)
            report["calls"].append({"model": model[0], "reasoning": model[1], "usage": {
                "input_tokens": "unknown", "output_tokens": "unknown", "total_tokens": "unknown",
                "cached_input_tokens": "unknown", "reasoning_output_tokens": "unknown"}})
            worker_log = run / (str(attempt) + "-worker.log")
            try:
                code = run_process(worker_command(workspace, model, schema, answer), workspace,
                                   args.timeout, worker_log, prompt)
            finally:
                report["calls"][-1]["usage"] = usage_from_log(worker_log)
                # Preserve the change list even when a worker times out or is interrupted.
                delta = changes(baseline, snapshot(workspace))
                report["files"] = delta
            if any(p not in allowed for p in delta):
                raise Stop("Unerwartete Dateiänderungen: " + ", ".join(p for p in delta if p not in allowed))
            if (subprocess.run(["git", "status", "--porcelain", "-uall"], cwd=ROOT,
                               check=True, capture_output=True).stdout != original_status
                    or any(not (ROOT / p).is_file() or hashlib.sha256((ROOT / p).read_bytes()).hexdigest() != h
                           for p, h in source.items())):
                raise Stop("Originalprojekt wurde während des Laufs verändert.")
            if code:
                raise Stop("Worker fehlgeschlagen; siehe Worker-Log.")
            result = validate_answer(answer)
            report["calls"][-1]["result"] = result
            if result["status"] == "complete":
                if not delta:
                    raise Stop("Keine Änderungen; Ergebnis muss manuell geklärt werden.")
                break
            if result["status"] == "needs_repair" and not repair_used:
                repair_used = True
                followup = "Einziger Reparaturversuch: " + result["summary"]
            elif result["status"] == "needs_sol" and not sol_used:
                sol_used = True
                model = SOL
                followup = "Einzige Eskalation an Sol: " + result["summary"]
            else:
                raise Stop("Gestoppt: " + result["summary"])
        else:
            raise Stop("Aufruflimit erreicht.")

        candidate = snapshot(workspace)
        # Copy installed dependencies only after coding. No symlinks to the original.
        for dependency in ("node_modules", ".venv"):
            if dependency == ".venv" and ["npm", "test"] not in check_plan(delta):
                continue
            if not (ROOT / dependency).is_dir():
                raise Stop("Installierte Abhängigkeiten fehlen: " + dependency)
            if dependency == "node_modules":
                copy_node_modules(ROOT / dependency, workspace / dependency)
            else:
                shutil.copytree(ROOT / dependency, workspace / dependency, symlinks=False)
                validate_backend_venv(workspace / dependency)
        for index, command in enumerate(check_plan(delta)):
            item = {"command": command, "status": "running"}
            report["checks"].append(item)
            code = run_process(command, workspace, args.timeout, run / (str(index) + "-check.log"))
            item["status"] = "passed" if code == 0 else "failed"
            if code:
                raise Stop("Prüfung fehlgeschlagen: " + " ".join(command))
            check_delta = changes(candidate, snapshot(workspace, checking=True))
            if check_delta:
                raise Stop("Prüfung änderte unerwartete Dateien: " + ", ".join(check_delta))
        if (subprocess.run(["git", "status", "--porcelain", "-uall"], cwd=ROOT,
                           check=True, capture_output=True).stdout != original_status
                or any(not (ROOT / p).is_file() or hashlib.sha256((ROOT / p).read_bytes()).hexdigest() != h
                       for p, h in source.items())):
            raise Stop("Originalprojekt wurde während des Laufs verändert.")
        report["status"] = "ready_for_manual_review"
        return 0
    except (Stop, OSError, subprocess.SubprocessError, KeyboardInterrupt) as exc:
        report["error"] = str(exc) or "Unterbrochen"
        print("STOP: " + report["error"], file=sys.stderr)
        return 1
    finally:
        (run / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
        print("Ergebnisprotokoll: " + str(run / "report.json"))
        print("Manuell prüfen: " + str(workspace))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("task", nargs="?", help="Eine konkrete Aufgabe oder TASKS.md-ID mit Beschreibung")
    parser.add_argument("--allow", action="append", default=[], help="Erlaubte Datei relativ zum Projekt; wiederholbar")
    parser.add_argument("--timeout", type=int, default=600, help="Sekunden je Worker/Prüfung (1–3600)")
    parser.add_argument("--dry-run", action="store_true", help="Nur Plan ausgeben; keine Aufrufe oder Schreibzugriffe")
    parser.add_argument("--auto", action="store_true", help="Sichere automatische Analyse/Planung; noch keine Coding-Ausführung")
    parser.add_argument("--max-calls", type=int, default=2, help="Aufruflimit der automatischen Planung (1–2)")
    parser.add_argument("--max-tokens", type=int, default=20000, help="Beobachtetes Tokenlimit zwischen Planungsaufrufen")
    parser.add_argument("--review", metavar="LAUF", help="Diff eines Laufs anzeigen (Pfad oder Lauf-ID)")
    parser.add_argument("--apply", metavar="LAUF", help="Diff prüfen und nach Bestätigung übernehmen")
    parser.add_argument("--file", action="append", default=[], help="Bei Review/Apply einzelne freigegebene Datei auswählen")
    args = parser.parse_args(argv)
    try:
        if args.review or args.apply:
            if args.auto:
                raise Stop("--auto kann nicht mit Review/Apply kombiniert werden.")
            run_arg = args.review or args.apply
            run = Path(run_arg)
            if not run.is_absolute():
                run = ROOT / "artifacts" / "orchestrator" / run
            review_run(run, apply=bool(args.apply), selected=args.file or None)
            return 0
        if args.auto:
            import orchestrator_planning
            return orchestrator_planning.plan(args, sys.modules[__name__])
        if not args.task or not args.allow:
            raise Stop("Aufgabe und mindestens ein --allow sind erforderlich.")
        if not args.task.strip() or not 1 <= args.timeout <= 3600:
            raise Stop("Aufgabe oder Timeout ungültig.")
        allowed = sorted({safe_path(p) for p in args.allow})
        model = route(args.task + " " + " ".join(allowed))
        rules = "\n".join((ROOT / p).read_text() for p in RULES)
        if args.dry_run:
            print(json.dumps({"dry_run": True, "model": model[0], "reasoning": model[1],
                              "manual_confirmation": model == SOL, "allowed_files": allowed,
                              "checks": check_plan(allowed), "timeout_seconds": args.timeout,
                              "max_calls": 3, "max_repairs": 1, "max_sol_escalations": 1,
                              "parallel_workers": 1, "rules_read": list(RULES),
                              "review": "Isolierte Kopie; keine automatische Übernahme."}, indent=2, ensure_ascii=False))
            return 0
        return execute(args, model, allowed, rules)
    except (Stop, OSError, subprocess.SubprocessError) as exc:
        print("STOP: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
