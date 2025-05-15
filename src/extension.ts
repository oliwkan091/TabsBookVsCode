
import * as vscode from 'vscode';


interface SavedTab {
	uri: string;
	isPinned: boolean;
  }


export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
	  vscode.commands.registerCommand('extension.saveTabs', () => {
		const tabs = vscode.window.tabGroups.all
		  .flatMap(group => group.tabs)
		  .filter(tab => tab.input instanceof vscode.TabInputText);
  
		const savedTabs: SavedTab[] = tabs.map(tab => {
		  const uri = (tab.input as vscode.TabInputText).uri.toString();
		  return {
			uri,
			isPinned: tab.isPinned ?? false
		  };
		});
  
		context.workspaceState.update('savedTabs', savedTabs);
		vscode.window.showInformationMessage('Tabs saved!');
	  })
	);
  
	context.subscriptions.push(
	  vscode.commands.registerCommand('extension.restoreTabs', async () => {
		const savedTabs: SavedTab[] | undefined = context.workspaceState.get('savedTabs');
		
		if (savedTabs === undefined)
		{
		  vscode.window.showWarningMessage('No saved tabs found.');
		  return;
		}

		const pinnedTabs = savedTabs.filter(t => t.isPinned);
		const unpinnedTabs = savedTabs.filter(t => !t.isPinned);

		// Step 1: Open all pinned tabs in background
		for (const tab of pinnedTabs) {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
		await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
		}

		// Step 2: Open an empty tab to reset focus
		const untitledDoc = await vscode.workspace.openTextDocument({ content: '', language: 'plaintext' });
		await vscode.window.showTextDocument(untitledDoc, { preview: false });

		// Step 3: Open all unpinned tabs in order
		for (const tab of unpinnedTabs) {
		const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
		await vscode.window.showTextDocument(doc, { preview: false });
}
  
		// if (!savedTabs) {
		//   vscode.window.showWarningMessage('No tabs saved.');
		//   return;
		// }
  
		// for (const tab of savedTabs) {
		//   const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(tab.uri));
		//   await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: !tab.isPinned });
		//   // Can't directly pin tab via API; preserveFocus simulates pin
		// }
  
		vscode.window.showInformationMessage('Tabs restored.');
	  })
	);
  }

export function deactivate() {}
