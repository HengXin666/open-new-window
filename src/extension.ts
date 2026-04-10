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
                const terminals = vscode.window.terminals;
                if (terminals.length === 0) {
                    vscode.window.showWarningMessage('没有打开的终端');
                    return;
                }

                let terminal: vscode.Terminal;

                if (terminals.length === 1) {
                    // 只有一个终端，直接使用
                    terminal = terminals[0];
                } else {
                    // 多个终端，收集有 cwd 的终端供用户选择
                    interface TerminalPickItem extends vscode.QuickPickItem {
                        terminal: vscode.Terminal;
                    }

                    const items: TerminalPickItem[] = terminals.map((t, i) => {
                        const cwd = (t as any).shellIntegration?.cwd as vscode.Uri | undefined;
                        const cwdPath = cwd?.fsPath ?? '未知路径';
                        const isActive = t === vscode.window.activeTerminal;
                        return {
                            label: `${isActive ? '$(terminal) ' : ''}${t.name || `终端 ${i + 1}`}`,
                            description: cwdPath,
                            detail: isActive ? '（当前活动终端）' : undefined,
                            terminal: t,
                        };
                    });

                    const picked = await vscode.window.showQuickPick(items, {
                        placeHolder: '选择要打开的终端工作目录',
                    });
                    if (!picked) {
                        return; // 用户取消选择
                    }
                    terminal = picked.terminal;
                }

                // 通过 shellIntegration 获取终端 cwd（需要 VSCode >= 1.93）
                const cwd = (terminal as any).shellIntegration?.cwd;
                if (cwd) {
                    await openInNewWindow(cwd);
                    return;
                }

                // 回退方案：让用户手动输入路径
                const input = await vscode.window.showInputBox({
                    prompt: `无法自动获取终端 "${terminal.name}" 的路径，请手动输入工作目录`,
                    placeHolder: '/path/to/directory',
                });
                if (input) {
                    await openInNewWindow(vscode.Uri.file(input));
                }
            }
        )
    );
}

export function deactivate() {}
