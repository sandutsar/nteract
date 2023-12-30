# nteract Desktop App Keyboard Shortcuts

The nteract desktop app provides keyboard shortcuts for common actions. See the table below for reference.

| Action                           | Shortcut                                        |
| -------------------------------- | ----------------------------------------------- |
| Auto-complete                    | Ctrl + Space                                    |
| Additional information (Python)  | Ctrl + .                                        |
| **File actions**                 |                                                 |
| Open                             | Ctrl+O                                          |
| Save                             | Ctrl+S                                          |
| Save As                          | Ctrl+Shift+S                                    |
| **Edit and notebook navigation** |                                                 |
| Redo changes in editor           | Ctrl+Shift+Z                                    |
| Undo changes in editor           | Ctrl+Z                                          |
| Copy Cell                        | Ctrl+Shift+C (nteract can also drag/drop cells) |
| Cut Cell                         | Ctrl+Shift+X                                    |
| Delete Cell                      | Ctrl+Shift+D                                    |
| Paste Cell(s) Below              | Ctrl+Shift+V                                    |
|                                  |                                                 |
| Convert Cell to Code Cell        | Ctrl+Shift+Y                                    |
| Convert Cell to Markdown Cell    | Ctrl+Shift+M                                    |
| Run Cell and Select Next         | Shift+Enter                                     |
| Run Cell                         | Alt+R, A                                        |
| Move Cursor Down                 | ArrowDown                                       |
| Move Cursor Up                   | ArrowUp                                         |
| Run Cell                         | Ctrl+Enter                                      |
| Insert Cell Above                | Ctrl+Shift+A                                    |
| Insert Cell Below                | Ctrl+Shift+B                                    |
| **Runtime kernel actions**       |                                                 |
| Interrupt Kernel                 | Alt+R, I                                        |
| Shutdown Kernel                  | Alt+R, K                                        |
| Restart Kernel                   | Alt+R, R                                        |
| Restart Kernel and Clear         | Alt+R, C                                        |
| Restart Kernel and Run All       | Alt+R, A                                        |

## Customizing Keyboard Shortcuts

Customize some keyboard shortcuts by changing the nteract config file. The config file `nteract.json` is in the Jupyter directory (e.g. `~/.jupyter`).

**Example:**

The code sample below shows the syntax.

```json
{
  "keyboardShortcuts": {
    "PublishGist": "Ctrl+P",
    "ClearAll": "Ctrl+Alt+C"
  }
}
```

nteract recognizes changes and displays new keyboard shortcuts in the menu after saving the config file. 

> NOTE: No restart is required for updates.

| **Supported commands:**| 
| --- |
| BringAllToFront |
| ChangeCellToCode |
| ChangeCellToText |
| ClearAll |
| ClearRecentDocuments |
| Close |
| Copy |
| CopyCell |
| Cut |
| CutCell |
| DeleteCell |
| DevTools |
| ExportPDF |
| Fullscreen |
| Hide |
| HideOthers |
| InstallShellCommand |
| InterruptKernel |
| KillKernel |
| Launch |
| LaunchNewNotebook |
| Minimize |
| NewCodeCellAbove |
| NewCodeCellBelow |
| NewKernel |
| NewNotebook |
| NewRawCellBelow |
| NewTextCellBelow |
| Open |
| Paste |
| PasteCell |
| PublishGist |
| Quit |
| Reload |
| RestartAndClearAll |
| RestartAndRunAll |
| RestartKernel |
| RunAll |
| RunAllAbove |
| RunAllBelow |
| Save |
| SaveAs |
| SelectAll |
| Unhide |
| UnhideAll |
| ZoomIn |
| ZoomOut |
| ZoomReset |
