import * as vscode from 'vscode';

//Mapping between invoke command and the function is in the package.json file

interface SavedTab {
    uri: string; // Save path to tab
    isPinned: boolean; // Check if tab is pinned
}

// structure to save tabs
// string - is a name that was given by user during save 
// SavedTab[] - are the extracted tabs
type TabCollections = Record<string, SavedTab[]>;

function makeTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}` +
           `:${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.saveTabsAs', async () => {
    // Gather current text‐editor tabs
    const tabs = vscode.window.tabGroups.all
      .flatMap(g => g.tabs)
      .filter(t => t.input instanceof vscode.TabInputText) as vscode.Tab[];

    // If none, warn and return
    if (tabs.length === 0) {
      vscode.window.showWarningMessage('No open tabs to save.');
      return;
    }

    // Name save group
    const name = await vscode.window.showInputBox({
      prompt: 'Enter a name for this set of tabs',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value.trim()) {
          return 'Name cannot be empty';
        }
		// Take all previously saved names
        const all: TabCollections = context.globalState.get('tabCollections', {});
        return all[value] ? `A set named "${value}" already exists` : null;
      }
    });
    if (!name) { return; }

    const saved: SavedTab[] = tabs.map(t => ({
      uri: (t.input as vscode.TabInputText).uri.toString(),
      isPinned: t.isPinned ?? false
    }));

    // Persist under that name
    const all: TabCollections = context.globalState.get('tabCollections', {});
    all[name] = saved;
    await context.globalState.update('tabCollections', all);

    vscode.window.showInformationMessage(`Tabs saved as “${name}”`);
  }));

    context.subscriptions.push(
         vscode.commands.registerCommand('extension.restoreTabs', async () => {
            const all: TabCollections = context.globalState.get('tabCollections', {});
            const names = Object.keys(all);
            if (names.length === 0) {
                vscode.window.showWarningMessage('No saved tab sets.');
                return;
            }
            const pick = await vscode.window.showQuickPick(names, { placeHolder: 'Select a set to restore' });
            if (!pick) { return; }

            const should = await vscode.window.showWarningMessage(
                `Restore tabs from “${pick}”?`,
                { modal: true },
                'Restore', 'Cancel'
            );
            if (should !== 'Restore') { return; }

            const savedTabs = all[pick]!;
            const pinned = savedTabs.filter(t => t.isPinned);
            const unpinned = savedTabs.filter(t => !t.isPinned);

			// Restore tabs are devided to 3 groups. Because there is no way to pin the tab by api, 
			// all pinned tabs are opened as firsts, with the order there way saved, then there is an 
			// empty tab and after it there are the unpinned tabs 

            // 1. pinned in background
            for (const tab of pinned) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
            }

            // 2. a timestamped “restored” divider
            const ts = makeTimestamp();
            const title = `restored ${ts}`;
            const uri = vscode.Uri.parse(`untitled:${title}`);
            const dividerDoc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(dividerDoc, { preview: false });

            // 3. unpinned normally
            for (const tab of unpinned) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                await vscode.window.showTextDocument(doc, { preview: false });
            }

            vscode.window.showInformationMessage(`Tabs restored from “${pick}”`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.deleteTabs', async () => {
            const all: TabCollections = context.globalState.get('tabCollections', {});
            const names = Object.keys(all);
            if (names.length === 0) {
                vscode.window.showWarningMessage('No saved tab sets to delete.');
                return;
            }

            const pick = await vscode.window.showQuickPick(names, {
                placeHolder: 'Select a saved tab-set to delete'
            });
            if (!pick) { return; }

            // confirmation
            const should = await vscode.window.showWarningMessage(
                `Delete saved tabs “${pick}”?`,
                { modal: true },
                'Delete',
                'Cancel'
            );
            if (should !== 'Delete') { return; }

            delete all[pick];
            await context.globalState.update('tabCollections', all);
            vscode.window.showInformationMessage(`Deleted saved tabs “${pick}”`);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.listTabs', async () => {
            const all: TabCollections = context.globalState.get('tabCollections', {});
            const names = Object.keys(all);
            if (names.length === 0) {
                vscode.window.showInformationMessage('No saved tab sets.');
                return;
            }

            const pick = await vscode.window.showQuickPick(names, {
                placeHolder: 'Select a saved tab-set to restore'
            });
            if (!pick) { return; }

            const should = await vscode.window.showWarningMessage(
                `Restore tabs from “${pick}”?`,
                { modal: true },
                'Restore',
                'Cancel'
            );
            if (should !== 'Restore') { return; }

            const savedTabs = all[pick]!;
            const pinned = savedTabs.filter(t => t.isPinned);
            const unpinned = savedTabs.filter(t => !t.isPinned);

            for (const tab of pinned) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
            }

            const empty = await vscode.workspace.openTextDocument({ content: '', language: 'plaintext' });
            await vscode.window.showTextDocument(empty, { preview: false });

            for (const tab of unpinned) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
                await vscode.window.showTextDocument(doc, { preview: false });
            }

            vscode.window.showInformationMessage(`Tabs restored from “${pick}”`);
        })
    );
}

export function deactivate() {}
