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
    overallRating: number;
    overallAssessment: string;

    runtimeImpact: 'Low' | 'Medium' | 'High';
    timeComplexity: string;
    estimatedRuntime: string;
    performanceAnalysis: string;
    performanceIssues: {
        title: string;
        location: string;
        impact: string;
        explanation: string;
    }[];

    bugs: ReviewIssue[];
    improvements: string[];
    bestPractices: string[];
    suggestedFix: string;
}

//creating gemini schema for the review result, to validate the ai response and ensure it follows the expected structure

const reviewSchema = {
	type: 'object',
	properties: {
		overallRating: {
			type: 'integer'
		},

		overallAssessment: {
			type: 'string'
		},

		runtimeImpact: {
			type: 'string',
			enum: ['Low', 'Medium', 'High']
		},

		timeComplexity: {
			type: 'string'
		},

		estimatedRuntime: {
			type: 'string'
		},

		performanceAnalysis: {
			type: 'string'
		},

		performanceIssues: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					title: { type: 'string' },
					location: { type: 'string' },
					impact: { type: 'string' },
					explanation: { type: 'string' }
				},
				required: [
					'title',
					'location',
					'impact',
					'explanation'
				]
			}
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
		'overallRating',
		'overallAssessment',
		'runtimeImpact',
		'timeComplexity',
		'estimatedRuntime',
		'performanceAnalysis',
		'performanceIssues',
		'bugs',
		'improvements',
		'bestPractices',
		'suggestedFix'
	]
};


async function reviewCode(prompt: string): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing');
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: reviewSchema
          }
        })
      }
    );

    if (response.ok) {
      const data = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      return JSON.parse(text) as ReviewResult;
    }

    const errorText = await response.text();

    if ((response.status === 503 || response.status === 429) &&
        attempt < maxAttempts) {
      await new Promise(resolve =>
        setTimeout(resolve, 2000 * Math.pow(2, attempt - 1))
      );
      continue;
    }

    const error = new Error(
      `Gemini API error ${response.status}: ${errorText}`
    );

    (error as Error & { status?: number }).status = response.status;

    throw error;
  }

  throw new Error('Gemini request failed after multiple attempts.');
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
const safeRating = Math.max(
	0,
	Math.min(100, Number(review.overallRating) || 0)
);

const safeRuntimeImpact = escapeHtml(review.runtimeImpact);
const safeTimeComplexity = escapeHtml(review.timeComplexity);
const safeEstimatedRuntime = escapeHtml(review.estimatedRuntime);
const safePerformanceAnalysis = escapeHtml(review.performanceAnalysis);

const performanceIssues = review.performanceIssues ?? [];

const performanceIssueCards = performanceIssues.length === 0
	? '<div class="no-issues">No significant performance bottlenecks identified.</div>'
	: performanceIssues.map(issue => `
		<div class="bug-item">
			<div class="bug-title">${escapeHtml(issue.title)}</div>
			<div class="bug-detail">
				<strong>Location:</strong> ${escapeHtml(issue.location)}
			</div>
			<div class="bug-detail">
				<strong>Impact:</strong> ${escapeHtml(issue.impact)}
			</div>
			<div class="bug-detail">
				<strong>Explanation:</strong> ${escapeHtml(issue.explanation)}
			</div>
		</div>
	`).join('');
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
	.rating-score {
	font-size: 32px;
	font-weight: 800;
	margin-bottom: 12px;
}

.rating-score span {
	font-size: 16px;
	font-weight: 500;
	opacity: 0.7;
}

.rating-meter {
	width: 100%;
	height: 8px;
	border-radius: 8px;
	overflow: hidden;
	background: var(--vscode-panel-border);
}

.rating-meter-fill {
	height: 100%;
	background: var(--vscode-progressBar-background);
	transition: width 0.2s ease;
}

.performance-metrics {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
	gap: 12px;
	margin-bottom: 16px;
}

.metric-card {
	padding: 12px;
	border-radius: 8px;
	background: var(--vscode-editor-background);
	border: 1px solid var(--vscode-panel-border);
	min-width: 0;
}

.metric-label {
	font-size: 11px;
	text-transform: uppercase;
	opacity: 0.7;
	margin-bottom: 8px;
}

.metric-value {
	font-size: 16px;
	font-weight: 700;
	overflow-wrap: anywhere;
}

.performance {
	border-left: 4px solid var(--vscode-progressBar-background);
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
	<div class="section-card">
	<div class="section-title">Overall Code Quality Rating</div>

	<div class="rating-score">
		${safeRating}<span> / 100</span>
	</div>

	<div class="rating-meter">
		<div
			class="rating-meter-fill"
			style="width: ${safeRating}%">
		</div>
	</div>
</div>

<div class="section-card performance">
	<div class="section-title">Runtime & Performance Analysis</div>

	<div class="performance-metrics">
		<div class="metric-card">
			<div class="metric-label">Runtime Impact</div>
			<div class="metric-value">${safeRuntimeImpact}</div>
		</div>

		<div class="metric-card">
			<div class="metric-label">Time Complexity</div>
			<div class="metric-value">${safeTimeComplexity}</div>
		</div>
	</div>

	<div class="section-title">Performance Explanation</div>
	<div class="section-content">${safePerformanceAnalysis}</div>

	<div class="section-title" style="margin-top: 18px">
		Estimated Runtime
	</div>
	<div class="section-content">${safeEstimatedRuntime}</div>

	<div class="section-title" style="margin-top: 18px">
		Performance Issues
	</div>

	<div class="bugs-container">
		${performanceIssueCards}
	</div>
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
Overall Code Quality Rating
${safeRating}/100

Overall Assessment
${review.overallAssessment}

Runtime Impact
${review.runtimeImpact}

Time Complexity
${review.timeComplexity}

Performance Analysis
${review.performanceAnalysis}

Estimated Runtime
${review.estimatedRuntime}

Performance Issues
${review.performanceIssues.map(issue =>
	`${issue.title}
Location: ${issue.location}
Impact: ${issue.impact}
Explanation: ${issue.explanation}`
).join('\n\n') || 'No significant performance bottlenecks identified.'}

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
	const rawFix = typeof review.suggestedFix === 'string'
		? review.suggestedFix.trim()
		: '';

	// Remove Markdown fences if Gemini unexpectedly includes them.
	const fencedFix = rawFix.match(
		/^```[^\r\n]*\r?\n([\s\S]*?)\r?\n```$/
	);
	const fix = (fencedFix ? fencedFix[1] : rawFix).trim();

	if (!fix || /^no\s+fix\s+required\.?$/i.test(fix)) {
		vscode.window.showInformationMessage(
			'No suggested fix is available.'
		);
		return;
	}

	const currentCode = editor.document.getText(targetRange);

	if (currentCode !== originalReviewedCode) {
		vscode.window.showWarningMessage(
			'The reviewed code has changed. Run the review again before applying the fix.'
		);
		return;
	}

	if (fix === currentCode) {
		vscode.window.showInformationMessage(
			'The suggested fix is identical to the current code. No changes were needed.'
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

	try {
		const applied = await editor.edit(editBuilder => {
			editBuilder.replace(targetRange, fix);
		});

		if (!applied) {
			vscode.window.showErrorMessage(
				'VS Code rejected the edit. Check whether the document is read-only or the edit is otherwise unavailable.'
			);
			console.error('Apply Fix failed: editor.edit() returned false.');
			return;
		}

		vscode.window.showInformationMessage(
			'Suggested fix applied successfully.'
		);
	} catch (error) {
		const details = error instanceof Error
			? error.message
			: String(error);

		console.error('Apply Fix failed:', error);

		vscode.window.showErrorMessage(
			`Failed to apply suggested fix: ${details}`
		);
	}
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
You are a professional AI code reviewer and performance analyst.

Return ONLY valid JSON matching the exact response schema provided.
Do not use Markdown code fences.
Do not add any text before or after the JSON.

Review the following ${language} code carefully.

1. OVERALL CODE QUALITY RATING
- Assign overallRating an integer from 0 to 100.
- Evaluate correctness (40%), efficiency (25%), readability (15%),
  maintainability (10%), and best practices (10%).
- Base the score on evidence in the submitted code.
- Do not arbitrarily assign high scores or invent problems.
- Explain the main reasons for the score in overallAssessment.

2. PERFORMANCE AND RUNTIME ANALYSIS
- Identify actual performance bottlenecks or operations that could
  significantly increase execution time.
- Examine nested loops, recursion, repeated computations,
  inefficient searches, unnecessary sorting, expensive I/O, and
  repeated function calls where relevant.
- runtimeImpact must be Low, Medium, or High, based on the
  significance of the identified performance concerns.
- Explain the overall performance characteristics in
  performanceAnalysis.
- For each meaningful performance issue, provide:
  title: a concise description of the bottleneck;
  location: the relevant line, loop, function, or code section;
  impact: how it affects execution time;
  explanation: why it occurs and how it could be improved.
- Return an empty performanceIssues array if no meaningful
  performance bottlenecks are found.
- Do not label normal code operations as errors without reason.
- Distinguish performance bottlenecks from correctness bugs.

3. TIME COMPLEXITY
- Determine the likely time complexity using Big-O notation,
  such as O(1), O(log n), O(n), O(n log n), or O(n^2).
- Explain how execution work grows with input size.
- Consider loops, nested loops, recursion, function calls,
  and relevant library or data-structure operations.
- State any assumptions about input size or implementation.
- If complexity cannot be determined confidently, explain why
  instead of inventing a result.

4. ESTIMATED RUNTIME
- Explain the likely execution-time behavior in estimatedRuntime.
- Do not fabricate exact execution times in milliseconds or seconds.
- Actual runtime depends on input size, hardware, environment,
  programming language, and runtime conditions.
- If actual time cannot be determined from static code analysis,
  explicitly state that benchmarking with defined inputs is needed.
- Where meaningful, describe which operations are likely to
  dominate runtime and how performance changes with input size.

5. BUGS AND EDGE CASES
- Identify actual bugs, reliability issues, and important edge cases.
- For each bug, provide title, severity, location, problem,
  whyItMatters, and howToFix.
- Severity must be Critical, High, Medium, or Low.
- Do not invent bugs. Return an empty bugs array if none are found.

6. IMPROVEMENTS AND BEST PRACTICES
- Include only relevant and actionable suggestions.
- Avoid generic, repetitive, or unnecessary advice.
- Explain recommendations clearly enough for a beginner.

7. SUGGESTED FIX
- If meaningful corrections are needed, return the complete
  corrected code in suggestedFix.
- Preserve the original programming language and proper indentation.
- Do not use Markdown code fences.
- Do not claim that code was executed or tested.
- If no fix is required, return "No fix required."

Ensure every required field in the response schema is present
and has the correct type.

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