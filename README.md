# AI Code Reviewer

AI Code Reviewer is a Visual Studio Code extension that uses the Gemini API to analyze source code, identify bugs and edge cases, suggest improvements, highlight best practices, and generate corrected code.

The project focuses on giving developers a clear and structured code review directly inside VS Code.

## Features

* Review selected code or the entire current file
* AI-powered bug and edge-case detection
* Structured review results using JSON
* Severity levels:

  * Critical
  * High
  * Medium
  * Low
* Individual bug cards in the review panel
* Overall code-quality assessment
* Improvement suggestions
* Relevant coding best practices
* Complete suggested code fix
* Copy the entire review to the clipboard
* Apply the suggested fix directly to the editor
* Protection against overwriting code that was modified after the review
* Empty-file validation
* Gemini API error handling
* Fallback model support when a model is temporarily unavailable
* Support for multiple programming languages

## How It Works

The extension follows this flow:

```text
Selected code / Current file
        ↓
VS Code Extension
        ↓
Review Prompt
        ↓
Gemini API + JSON Schema
        ↓
Structured JSON Response
        ↓
JSON.parse()
        ↓
ReviewResult Object
        ↓
VS Code Webview
        ↓
Bug Cards + Severity + Suggested Fix
```

Gemini is responsible for analyzing the code and generating review data.

The JSON schema defines the structure in which the AI should return that data.

TypeScript processes the structured result, while the Webview controls how the review is presented to the user.

## Review Structure

A review contains:

* Overall Assessment
* Bugs
* Improvements
* Best Practices
* Suggested Fix

Each detected bug contains:

* Title
* Severity
* Location
* Problem
* Why it matters
* How to fix

## Technologies Used

* TypeScript
* Visual Studio Code Extension API
* Gemini API
* `@google/genai`
* HTML
* CSS
* JavaScript
* dotenv
* Git and GitHub

## Installation for Development

Clone the repository:

```bash
git clone https://github.com/mithunkb1707-ops/ai-code-reviewer.git
```

Enter the project directory:

```bash
cd ai-code-reviewer
```

Install dependencies:

```bash
npm install
```

## Gemini API Key

Create a `.env` file in the project root:

```text
GEMINI_API_KEY=your_api_key_here
```

The `.env` file is excluded from Git and should never be committed.

## Running the Extension

Open the project in Visual Studio Code.

Press:

```text
F5
```

A new Extension Development Host window will open.

Open a source-code file, select code if desired, and run the AI Code Reviewer command from the Command Palette.

If no code is selected, the extension reviews the entire current file.

## Apply Suggested Fix

The extension can replace the reviewed code with Gemini's suggested corrected version.

Before applying the fix, it checks whether the original reviewed code has changed.

If the developer modified the code after the review was generated, the extension prevents the AI fix from overwriting those newer changes and asks the user to run another review.

## Error Handling

The extension handles common API problems including:

* Missing API key
* Authentication and permission errors
* Rate limits
* Unavailable models
* Temporary service overload
* Empty AI responses

It can also attempt a fallback Gemini model when the primary model encounters a temporary availability error.

## Tested With

The extension has been tested with multiple file types including:

* Python
* JavaScript
* JSON

The architecture is language-independent, allowing the selected VS Code language identifier to be included in the AI review request.

## Project Architecture

The project separates responsibilities between components:

**Prompt**
Defines what Gemini should analyze.

**JSON Schema**
Defines how Gemini should structure its response.

**ReviewResult / ReviewIssue**
Define the expected TypeScript data structures.

**Gemini API Layer**
Sends the code for analysis and converts the JSON response into a structured object.

**Webview**
Displays the review, issue cards, severity information, improvements, best practices, and suggested fix.

**Editor Integration**
Handles applying corrected code back into the VS Code editor.

## Security

AI-generated content is escaped before being inserted into the Webview to reduce the risk of unintended HTML injection.

The Gemini API key is stored in a local `.env` file and excluded through `.gitignore`.

## Known Limitations

* AI-generated reviews may occasionally contain inaccurate suggestions.
* A Gemini API connection is required.
* Review quality depends on the submitted code and available model.
* Suggested fixes should still be reviewed by the developer before being applied.

## Future Improvements

Possible future improvements include:

* Line-level diagnostics directly inside the VS Code editor
* Review history
* Configurable severity filters
* Automatic review on save
* More advanced code-fix previews
* Support for project-wide reviews

## Author

**Mithun K B**

Computer Science Engineering student

GitHub: `mithunkb1707-ops`

## Disclaimer

AI Code Reviewer is intended as a developer-assistance tool. AI-generated reviews and fixes should be verified before being used in production code.
