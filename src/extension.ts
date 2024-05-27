import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

const ROWS_PER_PAGE = 100;

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('feather-preview.previewFeatherFile', async (uri: vscode.Uri) => {
        if (!uri) {
            vscode.window.showErrorMessage('Please select a Feather file to preview.');
            return;
        }

        let currentPage = 1;

        const pythonScript = `
import sys
import json
import pandas as pd

feather_file_path = sys.argv[1]
page = int(sys.argv[2])
rows_per_page = ${ROWS_PER_PAGE}

df = pd.read_feather(feather_file_path)
total_rows = len(df)
start_index = (page - 1) * rows_per_page
end_index = start_index + rows_per_page

result = {
    'totalRows': total_rows,
    'currentPage': page,
    'rowsPerPage': rows_per_page,
    'dataHtml': df.iloc[start_index:end_index].to_html(index=False)
}

print(json.dumps(result))
`;

        const tempFilePath = path.join(context.extensionPath, 'tempPreviewFeather.py');
        fs.writeFileSync(tempFilePath, pythonScript);

        const panel = vscode.window.createWebviewPanel(
            'featherPreview',
            'Feather Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
            }
        );

        const showLoadingMessage = () => {
            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Feather Preview</title>
                </head>
                <body>
                    <div>Loading data...</div>
                </body>
                </html>
            `;
        };

        const updateWebview = async () => {
            showLoadingMessage();

            exec(`python "${tempFilePath}" "${uri.fsPath}" "${currentPage}"`, async (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Error previewing Feather file: ${error.message}`);
                    return;
                }

                const result = JSON.parse(stdout || stderr);
                const totalPages = Math.ceil(result.totalRows / result.rowsPerPage);

                panel.webview.html = `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Feather Preview</title>
                    </head>
                    <body>
                        ${result.dataHtml}
                        <div>
                            <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
                            <span>Page ${currentPage} of ${totalPages}</span>
                            <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                        </div>
                        <script>
                            const vscode = acquireVsCodeApi();
                            document.getElementById('prevPage').addEventListener('click', () => {
                                vscode.postMessage({ command: 'prevPage' });
                            });
                            document.getElementById('nextPage').addEventListener('click', () => {
                                vscode.postMessage({ command: 'nextPage' });
                            });
                        </script>
                    </body>
                    </html>
                `;
            });
        };

        updateWebview();

        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'prevPage':
                    if (currentPage > 1) {
                        currentPage--;
                        updateWebview();
                    }
                    break;
                case 'nextPage':
                    currentPage++;
                    updateWebview();
                    break;
            }
        });

    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}