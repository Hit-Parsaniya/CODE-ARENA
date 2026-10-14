# AI Code Review Rubric & Evaluation Criteria

## Scoring Rubric for Submissions

When an AI review is triggered on code submissions, the code is evaluated across five pillars:

| Pillar | Weight | Description | Key Checks |
| :--- | :--- | :--- | :--- |
| **Correctness** | 30% | Algorithmic logic and edge cases | Handles nulls, empty inputs, large bounds, recursion depth |
| **Time & Space Complexity** | 25% | Asymptotic efficiency | Optimal Big-O, avoids redundant computations, space footprint |
| **Code Cleanliness & Style** | 15% | Readability and idioms | PEP 8 / idiomatic patterns, naming conventions, separation of concerns |
| **Security & Safety** | 15% | Vulnerability avoidance | Sanitization, bounds checking, resource leaks, memory safety |
| **Maintainability & Docs** | 15% | Long-term code health | Modularity, descriptive comments, typing, testability |

## Feedback Levels
- **Critical (Blocker)**: Severe bug, infinite loop, memory leak, or security risk.
- **Warning**: Suboptimal complexity, potential edge case failure, code smell.
- **Suggestion**: Idiomatic improvement, cleaner syntax, minor optimization.
- **Commendation**: Elegant algorithmic trick or good architectural decision.
