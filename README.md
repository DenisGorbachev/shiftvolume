# Sideshift Volume Tracker

## Purpose

Sideshift Volume Tracker allows traders to bet on the increase of SideShift volume. Its price is programmed to be within 5% of "24h volume on sideshift.ai converted to USD and divided by 1,000,000". Thus, it is different from SAI, which has a freely fluctuating price. See specification to learn more about this token works.

## Specification

* Type: ERC-20 token
* Supply: variable, depending on price
* Price: within 5% of "24h volume on sideshift.ai converted to USD and divided by 1,000,000"
* Rebase period: every 24 hours at 00:05 UTC.
* Rebase formula: [see here](#rebase-formula)

## Rebase formula

```Wallet balance * (Current price - Target price) / (Target price) * 1 / Lag factor```

* `Wallet balance` is how many tokens you have before rebase.
* `Current price` is the price of a single token, calculated as a 24H TWAP equally weighted from [reputable exchanges](#exchanges).
* `Target price` is "24h volume on sideshift.ai converted to USD and divided by 1,000,000"
* `Lag factor` is a variable between 1 and 24, used to protect from abrupt supply changes. Currently, the lag factor is set manually by smart contract owner (this may change in future). A lag factor of 1 means "no lag" (supply is adjusted immediately to cover the difference between the current price and the target price).

## Exchanges

TODO
