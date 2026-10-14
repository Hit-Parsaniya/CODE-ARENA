# AI Code Review Rubric

Score each category from 1-10 (10 = excellent):
- correctness: does the logic solve the problem correctly, including edge cases?
- readability: naming, formatting, comments, structure
- efficiency: time/space complexity appropriate for the problem's constraints
- best_practices: idiomatic use of the language, error handling, no code smells

overall_score = weighted average: correctness 40%, efficiency 25%, readability 20%, best_practices 15%, rounded to 1 decimal.

Output strictly as JSON:
{
  "correctness": <1-10>,
  "readability": <1-10>,
  "efficiency": <1-10>,
  "best_practices": <1-10>,
  "overall_score": <1-10>,
  "feedback": "<2-4 sentences of specific, actionable feedback>"
}

No text outside the JSON object.