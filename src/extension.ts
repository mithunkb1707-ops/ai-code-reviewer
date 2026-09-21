// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';

//describes one bug or issue found in the code review
interface ReviewIssue {
	title: string;
	severity: 'Critical' | 'High' | 'Medium' | 'Low';
	location: string;
	problem: string;
	whyItMatters: string;
	howToFix: string;
}

//describe the whole ai code review result, including overall assessment, list of bugs, improvements, best practices, and suggested fix
interface ReviewResult {
	overallAssessment: string;
	bugs: ReviewIssue[];
	improvements: string[];
	bestPractices: string[];
	suggestedFix: string;
}

//creating gemini schema for the review result, to validate the ai response and ensure it follows the expected structure
const reviewSchema = {
	type: 'object',
	properties: {
		overallAssessment: {
			type: 'string'
		},

		bugs: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					title: { type: 'string' },

					severity: {
						type: 'string',
						enum: ['Critical', 'High', 'Medium', 'Low']
					},

					location: { type: 'string' },
					problem: { type: 'string' },
					whyItMatters: { type: 'string' },
					howToFix: { type: 'string' }
				},

				required: [
					'title',
					'severity',
					'location',
					'problem',
					'whyItMatters',
					'howToFix'
				]
			}
		},

		improvements: {
			type: 'array',
			items: {
				type: 'string'
			}
		},

		bestPractices: {
			type: 'array',
			items: {
				type: 'string'
			}
		},

		suggestedFix: {
			type: 'string'
		}
	},

	required: [
		'overallAssessment',
		'bugs',
		'improvements',
		'bestPractices',
		'suggestedFix'
	]
};

async function reviewCode(prompt: string): Promise<ReviewResult> {
	const { GoogleGenAI } = await import('@google/genai');

	const apiKey = process.env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is missing');
	}

	const ai = new GoogleGenAI({ apiKey });

	const models = [
	'gemini-3.8-flash',
	'gemini-3.5-flash'
];

let lastError: unknown;

for (const model of models) {
	try {
		const response = await ai.models.generateContent({
			model,
			contents: prompt,

			config: {
				responseMimeType: 'application/json',
				responseJsonSchema: reviewSchema
			}
		});

		const responseText = response.text;

		if (!responseText) {
			throw new Error('Gemini returned an empty response.');
		}

		return JSON.parse(responseText) as ReviewResult;

	} catch (error) {
		lastError = error;

		const status = (error as { status?: number }).status;

		if (status !== 503) {
			throw error;
		}
	}
}

throw lastError;
}

//Escape HTML special characters to prevent XSS in the webview
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}


//UI/UX Webview panel to show the review results (structured)
function showReviewPanel(
	review: ReviewResult,
	language: string,
	editor: vscode.TextEditor,
	targetRange: vscode.Range
) {

const issueCount = review.bugs.length;
const originalReviewedCode = editor.document.getText(targetRange);
const safeOverall = escapeHtml(review.overallAssessment);
const bugCards =
	review.bugs.length === 0
		? '<div class="no-issues">No major bugs found.</div>'
		: review.bugs
			.map((bug, index) => {
				const severityClass = bug.severity.toLowerCase();

				return `
					<div class="bug-item">
						<div class="bug-header">
							<div class="bug-title">
								Issue ${index + 1}: ${escapeHtml(bug.title)}
							</div>

							<div class="severity ${severityClass}">
								${escapeHtml(bug.severity)}
							</div>
						</div>

						<div class="bug-detail">
							<strong>Problem:</strong>
							${escapeHtml(bug.problem)}
						</div>

						<div class="bug-detail">
							<strong>Location:</strong>
							${escapeHtml(bug.location)}
						</div>

						<div class="bug-detail">
							<strong>Why it matters:</strong>
							${escapeHtml(bug.whyItMatters)}
						</div>

						<div class="bug-detail">
							<strong>How to fix:</strong>
							${escapeHtml(bug.howToFix)}
						</div>
					</div>
				`;
			})
			.join('');

const safeImprovements = escapeHtml(
	review.improvements.map(item => `• ${item}`).join('\n')
);

const safeBestPractices = escapeHtml(
	review.bestPractices.map(item => `• ${item}`).join('\n')
);

const safeSuggestedFix = escapeHtml(review.suggestedFix);
const safeLanguage = escapeHtml(language);
	const panel = vscode.window.createWebviewPanel(
		'aiCodeReview',
		'AI Code Review',
		vscode.ViewColumn.Beside,
		{
			enableScripts: true
		}
	);

//HTML content for the webview panel, including styles and structured layout
panel.webview.html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">

	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-foreground);
			padding: 24px;
			margin: 0;
		}

		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 24px;
		}

		.title {
			font-size: 24px;
			font-weight: 700;
		}

		.subtitle {
			opacity: 0.7;
			margin-top: 4px;
			font-size: 13px;
		}

		.badge {
			padding: 6px 12px;
			border-radius: 20px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
		}

		.section-card {
			margin-bottom: 16px;
			padding: 18px;
			border-radius: 10px;
			background: var(--vscode-sideBar-background);
			border: 1px solid var(--vscode-panel-border);
		}

		.section-title {
			font-size: 15px;
			font-weight: 700;
			margin-bottom: 10px;
		}

		.section-content {
	white-space: pre-wrap;
	line-height: 1.7;
	font-size: 14px;
	word-wrap: break-word;
}

.section-content strong {
	font-weight: 700;
	color: var(--vscode-foreground);
}

.suggested-fix .section-content {
	font-family: var(--vscode-editor-font-family);
	background: var(--vscode-textCodeBlock-background);
	padding: 14px;
	border-radius: 6px;
	overflow-x: auto;
	margin-bottom: 14px;
}

.section-card {
	transition: border-color 0.15s ease, transform 0.15s ease;
}

.section-card:hover {
	border-color: var(--vscode-focusBorder);
}

		.bugs {
			border-left: 4px solid #e5534b;
		}
			.bugs-container {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.bug-item {
	padding: 14px;
	border-radius: 8px;
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-panel-border);
}

.bug-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 12px;
	margin-bottom: 12px;
}

.bug-title {
	font-size: 14px;
	font-weight: 700;
}

.bug-detail {
	margin-top: 8px;
	line-height: 1.6;
	font-size: 13px;
}

.severity {
	padding: 4px 8px;
	border-radius: 12px;
	font-size: 11px;
	font-weight: 700;
	text-transform: uppercase;
}

.severity.critical,
.severity.high {
	background: rgba(229, 83, 75, 0.18);
}

.severity.medium {
	background: rgba(217, 164, 65, 0.18);
}

.severity.low {
	background: rgba(55, 148, 255, 0.18);
}

.no-issues {
	opacity: 0.75;
	font-size: 14px;
}

		.improvements {
			border-left: 4px solid #d9a441;
		}

		.best-practices {
			border-left: 4px solid #3794ff;
		}

		.suggested-fix {
			border-left: 4px solid #3fb950;
		}
			button {
	padding: 7px 12px;
	border-radius: 6px;
	border: none;
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	cursor: pointer;
}

button:hover {
	background: var(--vscode-button-hoverBackground);
}
	</style>
</head>

<body>

	<div class="header">
	<div>
		<div class="title">AI Code Review</div>

		<div class="subtitle">
	Automated analysis of the current file
	<span class="issue-count">
		${issueCount === 0
			? ' • No major issues detected'
			: ` • ${issueCount} issue${issueCount === 1 ? '' : 's'} detected`}
	</span>
</div>
	</div>

	<div style="display: flex; gap: 10px; align-items: center;">

		<button id="copyButton">
			Copy Review
		</button>

		<div class="badge">
			${safeLanguage}
		</div>

	</div>
</div>

	<div class="section-card">
		<div class="section-title">
			Overall Assessment
		</div>

		<div class="section-content">${safeOverall}</div>
	</div>

<div class="section-card bugs">
	<div class="section-title">
		Bugs
	</div>

	<div class="bugs-container">
		${bugCards}
	</div>
</div>

	<div class="section-card improvements">
		<div class="section-title">
			Improvements
		</div>

		<div class="section-content">${safeImprovements}</div>
	</div>

	<div class="section-card best-practices">
		<div class="section-title">
			Best Practices
		</div>

		<div class="section-content">${safeBestPractices}</div>
	</div>

	<div class="section-card suggested-fix">
		<div class="section-title">
			Suggested Fix
		</div>

		<div class="section-content">${safeSuggestedFix}</div>
		<button id="applyFixButton">
		Apply Suggested Fix
		</button>
	</div>
	<script>
	const vscode = acquireVsCodeApi();

	document.getElementById('copyButton').addEventListener('click', () => {
		vscode.postMessage({
			command: 'copyReview'
		});
	});

	document.getElementById('applyFixButton').addEventListener('click', () => {
		vscode.postMessage({
			command: 'applyFix'
		});
	});
</script>

</body>
</html>
`;
const bugsForClipboard =
	review.bugs.length === 0
		? 'No major bugs found.'
		: review.bugs
			.map((bug, index) => {
				return `Issue ${index + 1}: ${bug.title}
Severity: ${bug.severity}
Location: ${bug.location}
Problem: ${bug.problem}
Why it matters: ${bug.whyItMatters}
How to fix: ${bug.howToFix}`;
			})
			.join('\n\n');
			const reviewForClipboard = `
Overall Assessment
${review.overallAssessment}

Bugs
${bugsForClipboard}

Improvements
${review.improvements.map(item => `• ${item}`).join('\n') || 'None'}

Best Practices
${review.bestPractices.map(item => `• ${item}`).join('\n') || 'None'}

Suggested Fix
${review.suggestedFix}
`.trim();

panel.webview.onDidReceiveMessage(
	async message => {

		if (message.command === 'copyReview') {

			await vscode.env.clipboard.writeText(reviewForClipboard);

			vscode.window.showInformationMessage(
				'AI code review copied to clipboard.'
			);
		}
		if (message.command === 'applyFix') {

	const fix = review.suggestedFix.trim();

if (!fix || /^no\s+fix\s+required/i.test(fix)) {
	vscode.window.showInformationMessage(
		'No suggested fix is available.'
	);
	return;
}
	const currentCode = editor.document.getText(targetRange);

if (currentCode !== originalReviewedCode) {
	vscode.window.showWarningMessage(
		'The reviewed code has changed since the AI review. Run the review again before applying the fix.'
	);
	return;
}
	const choice = await vscode.window.showWarningMessage(
		'Apply the AI suggested fix to the reviewed code?',
		{ modal: true },
		'Apply Fix'
	);

	if (choice !== 'Apply Fix') {
		return;
	}

	await editor.edit(editBuilder => {
		editBuilder.replace(targetRange, fix);
	});

	vscode.window.showInformationMessage(
		'Suggested fix applied.'
	);
}
	}
);
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	dotenv.config({
	path: path.join(context.extensionPath, '.env')
});
	console.log('Congratulations, your extension "ai-code-reviewer" is now active!');

	const disposable = vscode.commands.registerCommand(
		'ai-code-reviewer.reviewCurrentFile',
		async () => {

			const editor = vscode.window.activeTextEditor;

			if (!editor) {
				vscode.window.showWarningMessage(
					'Please open a code file before reviewing.'
				);
				return;
			}
			const selection = editor.selection;
			const selectedCode = editor.document.getText(selection);

			const code = editor.document.getText();
			const language = editor.document.languageId;
			const codeToReview =
				selectedCode.trim().length > 0 ? selectedCode : code;
			const isSelection = selectedCode.trim().length > 0;

			const targetRange = isSelection
			? selection
			: new vscode.Range(
				editor.document.positionAt(0),
				editor.document.positionAt(code.length)
	);
			// Empty-file validation
			if (codeToReview.trim().length === 0) {
				vscode.window.showWarningMessage(
					'The current file is empty. Add some code before reviewing.'
				);
				return;
			}
			//The prompt im giving to the ai 
			const prompt = `
You are a professional AI code reviewer.

Review the following ${language} code carefully.

Analyze the code for:
- actual bugs and important edge cases,
- reliability and maintainability improvements,
- relevant best practices,
- and meaningful corrections.

For every bug:
- give it a short descriptive title,
- assign a severity of Critical, High, Medium, or Low,
- identify where it occurs,
- clearly explain the problem,
- explain why it matters,
- and explain how to fix it.

Do not invent bugs.

For improvements and best practices:
- only include advice that is relevant to the submitted code,
- avoid generic or unnecessary suggestions,
- explain things clearly enough for a beginner to understand.

For suggestedFix:
- if meaningful corrections are required, return the complete corrected code,
- preserve proper indentation and normal line breaks,
- format the code exactly as it should appear in a real source file,
- never minify or compress the code into a single line,
- do not use Markdown code fences,
- if no fix is required, return "No fix required."

Code:
${codeToReview}
`;
			console.log(prompt);

			// Show a progress notification while the AI is reviewing the code
			// Use a try-catch block to handle potential errors during the review process
			try {
				const review = await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'AI Code Reviewer',
						cancellable: false
					},
					async (progress) => {
						progress.report({
							message: isSelection
							? 'Reviewing selected code...'
							: 'Reviewing current file...'
						});

						return await reviewCode(prompt);
					}
				);

				showReviewPanel(review, language, editor, targetRange);
			} catch (error) {
	console.error('AI review failed:', error);

	const status = (error as { status?: number }).status;

	if (status === 429) {
		vscode.window.showWarningMessage(
			'Gemini rate limit reached. Please wait and try again.'
		);
		return;
	}

	if (status === 400 || status === 401 || status === 403) {
		vscode.window.showErrorMessage(
			'Gemini API authentication or permission error.'
		);
		return;
	}

	if (status === 404) {
		vscode.window.showErrorMessage(
			'The configured Gemini model is unavailable.'
		);
		return;
	}

	const message =
		error instanceof Error
			? error.message
			: String(error);

	vscode.window.showErrorMessage(
		`AI review failed: ${message}`
	);
}

			//await vscode.window.showTextDocument(reviewDocument);

			vscode.window.showInformationMessage(
	`Reviewed ${codeToReview.length} characters.`
			);
		}
	);

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}