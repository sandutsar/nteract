import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

export interface IEditor {
  layout(dimension: monaco.editor.IDimension): void;
  shouldLayout(): boolean;
  getLayoutDimension: () => monaco.editor.IDimension | undefined;
}

const editorsInSchedule: Map<IEditor, monaco.editor.IDimension | undefined> = new Map();
let layoutTimer: ReturnType<typeof requestAnimationFrame> | null = null;

function executeLayout() {
  layoutTimer = null;
  const editorsToLayout: Array<[IEditor, monaco.editor.IDimension]> = [];

  // do the first loop to collect editors and their dimensions for layouting, so we can read the DOM once to avoid layout thrashing
  for (const [editor, scheduledDimention] of editorsInSchedule) {
    if (editor.shouldLayout()) {
      let dim = scheduledDimention;
      if (!dim) {
        dim = editor.getLayoutDimension();
      }

      // skip layout if dimension is not available
      if (dim) {
        editorsToLayout.push([editor, dim]);
      }
    }
  }

  // the second loop to execute the layouts
  for (const [editor, dim] of editorsToLayout) {
    editor.layout(dim);
  }

  editorsInSchedule.clear();
}

/**
 * For monaco editors, we need to call layout() on any editors that might have changed size otherwise the view will look off.
 * These updates often happen together with other editors, such as when the window resizes.
 * In order to avoid layout thrashing, we batch these layout calls together and perform them all at once in a RAF timeout.
 */
export function scheduleEditorForLayout(editor: IEditor, layout?: monaco.editor.IDimension): void {
  editorsInSchedule.set(editor, layout);
  if (!layoutTimer) {
    // Using RAF here ensures that the layout will happen on the next frame.
    layoutTimer = requestAnimationFrame(executeLayout);
  }
}
