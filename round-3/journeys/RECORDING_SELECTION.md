# Recording selection correction

The first recording attempt selected 27 stories (54 viewport recordings). WordListUnavailable is a static error-state story with no play function, so native replay has no checkpoint; both attempts timed out. This is preserved in candidate-4c0543986/interactions/videos.log and its raw capture manifest. It is not a product retry failure.

The final recording selection is 26 interactive stories (52 recordings). The required word-list retry with a retained draft is already exercised by ReachTarget, including disabled submit before retry, preserved S at j8, enabled submit after retry and solved output after submission. Both ReachTarget recordings completed. WordListUnavailable remains in all four screenshot states and the canonical browser matrix. No story, assertion, timeout or product behavior was changed to bypass the recording failure.
