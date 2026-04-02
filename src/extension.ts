import * as path from 'path';
import * as vscode from 'vscode';

function openInNewWindow(folderUri: vscode.Uri) {
    return vscode.commands.executeCommand('vscode.openFolder', folderUri, {
        forceNewWindow: true,
    });
}

export function activate(context: vscode.ExtensionContext) {
    // 右键文件 / 标签栏 → 以父目录为工作区打开新窗口
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'open-new-window.openParentInNewWindow',
            async (uri?: vscode.Uri) => {
                let targetUri = uri;
                if (!targetUri) {
                    targetUri = vscode.window.activeTextEditor?.document.uri;
                }
                if (!targetUri) {
                    vscode.window.showWarningMessage('没有可用的文件路径');
                    return;
                }
                const dirPath = path.posix.dirname(targetUri.path);
                await openInNewWindow(targetUri.with({ path: dirPath }));
            }
        )
    );

    // 右键文件夹 → 以该文件夹为工作区打开新窗口
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'open-new-window.openFolderInNewWindow',
            async (uri?: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showWarningMessage('没有可用的文件夹路径');
                    return;
                }
                await openInNewWindow(uri);
            }
        )
    );
}

export function deactivate() {}
