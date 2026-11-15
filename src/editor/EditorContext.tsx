import { createContext, useContext, type RefObject } from "react";
import type { Selection } from "../JournalCanvas";
import type { Chapter, Journey, Layout, Photo } from "../types";
import type { LayoutIssue } from "./layoutIssue";

/**
 * What the settings panel needs from the editor: the open journey, the selection
 * and the actions that change them. ModularEditor owns the state and provides this.
 */
export type EditorContextValue = {
  journey: Journey;
  selected: Selection;
  /** The selected module, if a module is selected. */
  module: Chapter | undefined;
  /** The selected photograph in its placement, if a photograph is selected. */
  photo: Photo | undefined;
  /** The module the selected photograph sits in. */
  photoModule: Chapter | undefined;
  selectionLabel: string;
  busy: boolean;
  backgroundSaving: boolean;
  uploadBusy: boolean;
  conflicted: boolean;
  titleInput: RefObject<HTMLInputElement | null>;
  change: (patch: Partial<Journey>) => void;
  moduleChange: (id: number, patch: Partial<Chapter>) => void;
  photoChange: (id: number, patch: Partial<Photo>) => void;
  layoutChange: (id: number | null, patch: Partial<Layout>) => void;
  save: () => Promise<Journey | null>;
  selectCanvas: (selection: Selection) => void;
  returnToModule: () => void;
  removePlacement: () => void;
  adoptPhotoDates: (range: { start: string; end: string }) => void;
  reorder: (id: number, dir: number) => void;
  duplicate: (module: Chapter) => void;
  requestModuleRemoval: (id: number, trigger: HTMLElement) => void;
  uploaded: (value: Journey) => void;
  askDeleteUploaded: (id: number) => void;
  markConflict: () => void;
  setUploadBusy: (busy: boolean) => void;
  openPicker: () => void;
  /** Opens the image chooser for the cover (true) or for the selected photograph (false). */
  chooseImage: (forCover: boolean) => void;
  deletePhoto: (photo: Photo) => void;
  /** Pending request to put the cursor into a text field of the settings panel. */
  textFocus: { moduleId: number; field: "story" | "quote"; nonce: number } | null;
  /** Last save rejected because of one module's setting (shown in that module's pane). */
  layoutIssue: LayoutIssue | null;
  /** Called by the settings panel once the field has been focused. */
  clearTextFocus: () => void;
  /** Switches to the preview and scrolls the selection into view. */
  showSelectionInPreview: () => void;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor needs an EditorContext provider");
  return value;
}
