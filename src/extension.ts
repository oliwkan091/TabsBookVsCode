import * as vscode from 'vscode';

interface SavedTab {
    uri: string;
    isPinned: boolean;
}

interface SavedTabSet {
    tabs: SavedTab[];
    workspacePath: string;
}

type TabCollections = Record<string, SavedTabSet>;

function getCurrentWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    //First folder identifies the workspace
    return folders[0].uri.toString();
}

export function activate(context: vscode.ExtensionContext) {

    //Save Tabs
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.saveTabsAs', async () => {
            const currentWorkspace = getCurrentWorkspaceRoot();
            if (!currentWorkspace) {
                vscode.window.showErrorMessage('You must have a folder opened to save tabs contextually.');
                return;
            }

            const tabs = vscode.window.tabGroups.all
                .flatMap(g => g.tabs)
                .filter(t => t.input instanceof vscode.TabInputText) as vscode.Tab[];

            if (tabs.length === 0) {
                vscode.window.showWarningMessage('No open tabs to save.');
                return;
            }

            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for this set of tabs',
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (!value.trim()) {
                        return 'Name cannot be empty';
                    }
                    const all: TabCollections = context.globalState.get('tabCollections', {});
                    if (all[value] && all[value].workspacePath === currentWorkspace) {
                        return `A set named "${value}" already exists in this workspace`;
                    }
                    return null;
                }
            });
            if (!name) { return; }

            const savedTabs: SavedTab[] = tabs.map(t => ({
                uri: (t.input as vscode.TabInputText).uri.toString(),
                isPinned: t.isPinned ?? false
            }));

            const all: TabCollections = context.globalState.get('tabCollections', {});
            
            all[name] = {
                tabs: savedTabs,
                workspacePath: currentWorkspace
            };
            
            await context.globalState.update('tabCollections', all);
            vscode.window.showInformationMessage(`Tabs saved as “${name}” for current workspace.`);
        })
    );

    //Restore tabs
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.restoreTabs', async () => {
            const currentWorkspace = getCurrentWorkspaceRoot();
            if (!currentWorkspace) {
                vscode.window.showErrorMessage('Open a folder to see its saved tabs.');
                return;
            }

            const all: TabCollections = context.globalState.get('tabCollections', {});
            
            const names = Object.keys(all).filter(key => {
                const item = all[key];
                return item && item.workspacePath === currentWorkspace;
            });

            if (names.length === 0) {
                vscode.window.showWarningMessage('No saved tab sets for this workspace.');
                return;
            }

            const pick = await vscode.window.showQuickPick(names, { placeHolder: 'Select a set to restore' });
            if (!pick) { return; }

            const savedSet = all[pick]; 
            const savedTabs = savedSet.tabs;

            const pinned = savedTabs.filter(t => t.isPinned);
            const unpinned = savedTabs.filter(t => !t.isPinned);

            for (const tab of pinned) {
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                    await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
                    await vscode.commands.executeCommand('workbench.action.pinEditor');
                } catch (e) {
                    console.error(`Could not open ${tab.uri}`);
                }
            }

            for (const tab of unpinned) {
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                    await vscode.window.showTextDocument(doc, { preview: false });
                } catch (e) {
                    console.error(`Could not open ${tab.uri}`);
                }
            }

            vscode.window.showInformationMessage(`Tabs restored from “${pick}”`);
        })
    );

    //Delete tabs
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.deleteTabs', async () => {
            const currentWorkspace = getCurrentWorkspaceRoot();
            if (!currentWorkspace) {
                vscode.window.showErrorMessage('Open a folder to manage saved tabs.');
                return;
            }

            const all: TabCollections = context.globalState.get('tabCollections', {});
            
            const names = Object.keys(all).filter(key => all[key]?.workspacePath === currentWorkspace);

            if (names.length === 0) {
                vscode.window.showWarningMessage('No saved tab sets to delete in this workspace.');
                return;
            }

            const pick = await vscode.window.showQuickPick(names, {
                placeHolder: 'Select a saved tab-set to delete'
            });
            if (!pick) { return; }

            const should = await vscode.window.showWarningMessage(
                `Delete saved tabs “${pick}”?`,
                { modal: true },
                'Delete', 'Cancel'
            );

            if (should === 'Delete') {
                delete all[pick];
                await context.globalState.update('tabCollections', all);
                vscode.window.showInformationMessage(`Deleted saved tabs “${pick}”`);
            }
        })
    );
}

export function deactivate() {}