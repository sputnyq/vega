-- Centralize Anfahrtskosten per truck count, carrying forward the highest rate
-- already configured for any worker count with that truck count. When no offer
-- exists for a truck count, no rate row is written so the missing configuration
-- stays distinguishable from a deliberately configured 0 EUR rate.
INSERT INTO `catalogServiceRate` (`key`, `price`)
SELECT 'ridingCostsTruck1', MAX(`ridingCosts`)
FROM `catalogOffer` WHERE `trucks` = 1
HAVING COUNT(*) > 0;

INSERT INTO `catalogServiceRate` (`key`, `price`)
SELECT 'ridingCostsTruck2', MAX(`ridingCosts`)
FROM `catalogOffer` WHERE `trucks` = 2
HAVING COUNT(*) > 0;

INSERT INTO `catalogServiceRate` (`key`, `price`)
SELECT 'ridingCostsTruck3', MAX(`ridingCosts`)
FROM `catalogOffer` WHERE `trucks` = 3
HAVING COUNT(*) > 0;

INSERT INTO `catalogServiceRate` (`key`, `price`)
SELECT 'ridingCostsTruck4', MAX(`ridingCosts`)
FROM `catalogOffer` WHERE `trucks` = 4
HAVING COUNT(*) > 0;
