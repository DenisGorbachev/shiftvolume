# Sideshift Volume Tracker

## Purpose

Sideshift Volume Tracker allows traders to bet on the increase of SideShift volume. Its price is programmed to be within 5% of "24h volume on sideshift.ai converted to USD and divided by 1,000,000". Thus, it is different from SAI, which has a freely fluctuating price. See specification to learn more about this token works.

## Specification

* Type: ERC-20 token
* Supply: variable, depending on price
* Price: within 5% of "24h volume on sideshift.ai converted to USD and divided by 1,000,000"
* Rebase formula: ```Wallet balance * (Current price - Target price) / (Target price)```
* Rebase period: every 24 hours at 00:05 UTC.
