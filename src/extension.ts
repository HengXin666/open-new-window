import * as path from 'path';
import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('Open in New Window');

function log(message: string) {
    outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function openInNewWindow(folderUri: vscode.Uri) {
    return vscode.commands.executeCommand('vscode.openFolder', folderUri, {
        forceNewWindow: true,
    });
}

/**
 * 将路径字符串转换为与当前工作环境一致的 URI。
 * 在远程 SSH 环境下，需要使用 vscode-remote:// scheme。
 */
function pathToWorkspaceUri(fsPath: string): vscode.Uri {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (wsFolder && wsFolder.uri.scheme !== 'file') {
        // 远程环境：复用工作区的 scheme 和 authority
        return wsFolder.uri.with({ path: fsPath });
    }
    return vscode.Uri.file(fsPath);
}

/**
 * 确保 URI 的 scheme 与当前工作环境一致。
 * 在远程 SSH 环境下，shellIntegration.cwd 可能返回 file:// scheme，
 * 需要修正为 vscode-remote:// scheme。
 */
function ensureCorrectUri(uri: vscode.Uri): vscode.Uri {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    log(`ensureCorrectUri - input: ${uri.toString()} (scheme=${uri.scheme}, authority=${uri.authority}, path=${uri.path})`);
    log(`ensureCorrectUri - wsFolder: ${wsFolder?.uri.toString() ?? 'undefined'}`);
    log(`ensureCorrectUri - remoteName: ${vscode.env.remoteName ?? 'undefined'}`);

    if (!wsFolder) {
        return uri;
    }

    // 如果当前工作区是远程的（scheme 不是 file），但 cwd 的 scheme 是 file
    // 说明需要修正 URI 的 scheme 和 authority
    if (wsFolder.uri.scheme !== 'file' && uri.scheme === 'file') {
        const corrected = wsFolder.uri.with({ path: uri.path });
        log(`ensureCorrectUri - corrected to: ${corrected.toString()}`);
        return corrected;
    }

    // 如果处于远程环境但 URI 的 scheme 和 authority 与工作区不一致，也需要修正
    if (vscode.env.remoteName && wsFolder.uri.scheme !== 'file') {
        if (uri.scheme !== wsFolder.uri.scheme || uri.authority !== wsFolder.uri.authority) {
            const corrected = wsFolder.uri.with({ path: uri.path });
            log(`ensureCorrectUri - remote mismatch, corrected to: ${corrected.toString()}`);
            return corrected;
        }
    }

    log(`ensureCorrectUri - no correction needed, returning: ${uri.toString()}`);
    return uri;
}

/**
 * 尝试获取终端的当前工作目录 URI。
 * 优先使用 shellIntegration.cwd，失败时尝试其他方案。
 */
async function getTerminalCwd(terminal: vscode.Terminal): Promise<vscode.Uri | undefined> {
    // 方案一：通过 shellIntegration 获取终端 cwd（需要 VSCode >= 1.93）
    const shellCwd = terminal.shellIntegration?.cwd;
    if (shellCwd) {
        return ensureCorrectUri(shellCwd);
    }

    // 方案二：如果 shellIntegration 不可用，等待其初始化
    // shellIntegration 可能在终端刚创建时还未就绪
    const shellIntegration = await waitForShellIntegration(terminal, 3000);
    if (shellIntegration?.cwd) {
        return ensureCorrectUri(shellIntegration.cwd);
    }

    return undefined;
}

/**
 * 等待终端的 shellIntegration 初始化完成。
 */
function waitForShellIntegration(
    terminal: vscode.Terminal,
    timeoutMs: number
): Promise<vscode.TerminalShellIntegration | undefined> {
    // 如果已经有了，直接返回
    if (terminal.shellIntegration) {
        return Promise.resolve(terminal.shellIntegration);
    }

    return new Promise<vscode.TerminalShellIntegration | undefined>((resolve) => {
        const timeout = setTimeout(() => {
            disposable.dispose();
            resolve(undefined);
        }, timeoutMs);

        const disposable = vscode.window.onDidChangeTerminalShellIntegration((e) => {
            if (e.terminal === terminal) {
                clearTimeout(timeout);
                disposable.dispose();
                resolve(e.shellIntegration);
            }
        });
    });
}

export function activate(context: vscode.ExtensionContext) {
    // 状态栏按钮：当终端获得焦点时显示
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        1000
    );
    statusBarItem.command = 'open-new-window.openTerminalCwdInNewWindow';
    statusBarItem.text = '$(multiple-windows)';
    statusBarItem.tooltip = '新窗口打开 (终端当前目录)';
    context.subscriptions.push(statusBarItem);

    // 监听终端焦点变化，终端激活时显示按钮
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal) {
                statusBarItem.show();
            } else {
                statusBarItem.hide();
            }
        })
    );

    // 监听编辑器焦点变化，切换到编辑器时隐藏按钮
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            statusBarItem.hide();
        })
    );

    // 如果激活时已有活动终端，立即显示
    if (vscode.window.activeTerminal) {
        statusBarItem.show();
    }

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

                const cwdUri = await getTerminalCwd(terminal);
                if (cwdUri) {
                    log(`openTerminalCwdInNewWindow - opening: ${cwdUri.toString()}`);
                    await openInNewWindow(cwdUri);
                    return;
                }
                log(`openTerminalCwdInNewWindow - failed to get cwd, falling back to input box`);

                // 回退方案：让用户手动输入路径，并保留当前工作区的 URI scheme
                const input = await vscode.window.showInputBox({
                    prompt: `无法自动获取终端 "${terminal.name}" 的路径，请手动输入工作目录`,
                    placeHolder: '/path/to/directory',
                });
                if (input) {
                    await openInNewWindow(pathToWorkspaceUri(input));
                }
            }
        )
    );
}

export function deactivate() {}
