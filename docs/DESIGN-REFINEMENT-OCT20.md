# Warm Horizon refinement

The owner selected version 2 as the sole visual reference and asked for a
clearer, more actionable Bee-like interface. This pass implements that choice
in the running app rather than creating another disconnected prototype.

## Changes

- Restored the original sun/landscape asset, warm yellow/lilac field, olive
  capacity panel, lilac recommendation, and glass goal/range controls.
- Replaced the vague opening slogan with the actual time conflict. A/B are
  named actions with their release-date consequence and request dependency.
- Kept C secondary with a visible scope/time consequence. Selecting an option
  updates the actual proposed work blocks; after-deadline blocks are labeled.
- Replaced abstract curve interpretation with concrete weekday/time blocks.
  The hours meter measures allocated work, not a personal probability.
- Added a selectable A/B week timeline. It places release and presentation
  focus blocks against dates, makes work after Friday visible, and updates the
  selected plan when a path is chosen. The responsive phone layout is web; a
  native iOS app remains unbuilt.
- Replaced raw availability JSON and timestamp strings with labeled date/time
  inputs and add/remove availability rows.
- Reduced review to one explicit save/send control after reviewing the actual
  message and proposed times. Local-only and disconnected states are explicit.
- Replaced technical receipt/status labels with saved/sent/needs-checking
  outcomes. Provider IDs remain available in receipt details.
- Grow uses a quieter goal list and direct wording. Reconcile shows inline
  record comparisons and a reversible local merge for Bee task groups.

## Design review

Luna reviewed the reference and live layouts. Its main findings were duplicated
taglines, unclear consequences, and generic supporting screens. Those changes
are incorporated. An early asset-loading finding came from the pre-restart
server; the final preview loads the landscape and navigation SVGs successfully.

Primary guidance reviewed: [Impeccable](https://github.com/pbakaus/impeccable),
[Humanizer](https://github.com/blader/humanizer), and
[unslop](https://github.com/mshumer/unslop). The applied rules are documented in
[DESIGN.md](../DESIGN.md). No Impeccable detector or Unslop generation run is
claimed, and no global skill configuration was installed.

Browser inspection covered desktop and 390px mobile, option changes, normal
date/time fields, and asset loading. Existing backend gates and Google login
requirements remain as documented in the implementation checkpoint.
