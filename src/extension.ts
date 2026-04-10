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

    // 以终端当前工作目录打开新窗口
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'open-new-window.openTerminalCwdInNewWindow',
            async () => {
                const terminal = vscode.window.activeTerminal;
                if (!terminal) {
                    vscode.window.showWarningMessage('没有活动的终端');
                    return;
                }

                // 通过 shellIntegration 获取终端 cwd（需要 VSCode >= 1.93）
                const cwd = (terminal as any).shellIntegration?.cwd as vscode.Uri | undefined;
                if (cwd) {
                    // shellIntegration.cwd 返回的 Uri 已经包含正确的 scheme
                    // 本地是 file://，远程 SSH 是 vscode-remote://，可以直接使用
                    await openInNewWindow(cwd);
                    return;
                }

                // 回退方案：让用户手动输入路径，并保留当前工作区的 URI scheme
                const input = await vscode.window.showInputBox({
                    prompt: `无法自动获取终端 "${terminal.name}" 的路径，请手动输入工作目录`,
                    placeHolder: '/path/to/directory',
                });
                if (input) {
                    // 如果当前有工作区文件夹，复用其 URI scheme（兼容远程 SSH 场景）
                    const wsFolder = vscode.workspace.workspaceFolders?.[0];
                    if (wsFolder) {
                        await openInNewWindow(wsFolder.uri.with({ path: input }));
                    } else {
                        await openInNewWindow(vscode.Uri.file(input));
                    }
                }
            }
        )
    );
}

export function deactivate() {}
