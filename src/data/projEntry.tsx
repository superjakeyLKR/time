import HotkeyVue from "components/Hotkey.vue";
import Node from "components/Node.vue";
import Spacer from "components/layout/Spacer.vue";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createResource, trackBest, trackOOMPS, trackTotal } from "features/resources/resource";
import type { GenericTree } from "features/trees/tree";
import { branchedResetPropagation, createTree } from "features/trees/tree";
import { createUpgrade } from "features/upgrades/upgrade";
import { globalBus } from "game/events";
import type { BaseLayer, GenericLayer } from "game/layers";
import { addLayer, createLayer, removeLayer } from "game/layers";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";
import { noPersist, persistent } from "game/persistence";
import type { Player } from "game/player";
import player from "game/player";
import { createCostRequirement } from "game/requirements";
import type { DecimalSource } from "util/bignum";
import Decimal, { format, formatTime } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { computed, toRaw } from "vue";
import timeCondenser from "./layers/timeCondenser";
import space from "./layers/space";
import { createTabFamily } from "features/tabs/tabFamily";
import { createTab } from "features/tabs/tab";

/**
 * @hidden
 */
export const main = createLayer("main", function (this: BaseLayer) {
    const points = createResource<DecimalSource>(160000);
    const best = trackBest(points);
    const total = trackTotal(points);

    const pointGain = computed(() => {
        let gain = new Decimal(1);
        for (const modifier of upgradeModifiers) {
            gain = new Decimal(modifier.apply(gain));
        }
        for (const modifier of timeCondenser.row1UpgradeModifiers) {
            gain = new Decimal(modifier.apply(gain));
        }

        if (Decimal.lte(windProgress.value, 0)) {
            return new Decimal(0);
        }
        return gain;
    });

    globalBus.on("update", diff => {
        points.value = Decimal.add(points.value, Decimal.times(pointGain.value, diff));
    });

    const oomps = trackOOMPS(points, pointGain);

    const tree = createTree(() => ({
        nodes: [[timeCondenser.treeNode]],
        branches: [],
        onReset() {
            points.value = toRaw(this.resettingNode.value) === toRaw(timeCondenser.treeNode) ? 0 : 10;
            best.value = points.value;
            total.value = points.value;
            for (const upgrade of upgrades) {
                upgrade.bought.value = false;
            }
        },
        resetPropagation: branchedResetPropagation
    })) as GenericTree;

    const windProgress = persistent<DecimalSource>(0);
    const maxProgress = 10;
    const windInterval = 10;
    var canWind = true;
    var isHoldingWind = false;

    const progressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: 0px; transition-duration: 0.1s",
        progress: () => Decimal.div(windProgress.value, getMaxProgress())
    }));

    const windHotkey = createHotkey(() => ({
        description: "Wind the power generator",
        key: "w",
        onPress() {
            winder.onClick();
        }
    }));

    const winder = createClickable(() => ({
        display: jsx(() => (
            <h3>
                Wind <HotkeyVue hotkey={windHotkey} />
                <Spacer />
                The power generator must be wound to generate time.
                <Spacer />
                {render(progressBar)}
            </h3>
        )),
        style: {
            transition: "transform 0.1s"
        },
        canClick: () => true,
        onClick: () => {
            if (!canWind) return

            isHoldingWind = true;

            windProgress.value = Decimal.add(windProgress.value, 1);

            var max = getMaxProgress();
            if (Decimal.gte(windProgress.value, max)) {
                windProgress.value = max;
            }

            canWind = false;

            setTimeout(() => {
                canWind = true;
            }, windInterval);
        }
    }));

    function getMaxProgress() {
        var hasCondenserUpgrade5 = timeCondenser.row1Upgrades[4].bought;
        return maxProgress * (hasCondenserUpgrade5 ? 2 : 1);
    }

    const upgrade1 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 25
        })),
        display: {
            description: "The power genarator's wind amount improves time generation.",
        }
    }));

    const upgrade2 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 150
        })),
        display: {
            description: "Double power generation, and make the power generator decay slower.",
        },
        onPurchase() {
            clearInterval(decayInterval);
            decayInterval = setInterval(() => {
                if (isHoldingWind) {
                    isHoldingWind = false;
                    return;
                }
                windProgress.value = Decimal.sub(windProgress.value, 1);
                if (Decimal.lte(windProgress.value, 0)) {
                    windProgress.value = 0;
                }
            }, 1000);
        }
    }));

    const upgrade3 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 300
        })),
        display: {
            description: "Your time played boosts time generation.",
        }
    }));

    const upgrade4 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 650
        })),
        display: {
            description: "The previous upgrades boost time 50% more.",
        }
    }));

    // I LOVE CICLICAL REFRENCING 
    const upgrade5: any = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 1e6
        })),
        display: {
            description: "Unlock the space tab. Double both time and compressed time gain.",
        },
        visibility: () => Decimal.gte(points.value, 7.5e5) || upgrade5.bought,
    }));

    const upgrade1Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => upgrade4Modifier.apply(Decimal.pow(windProgress.value, 0.75).floor()),
            description: "Time Upgrade 1",
            enabled: upgrade1.bought
        }))
    ]);

    const upgrade2Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: upgrade4Modifier.apply(2),
            description: "Time Upgrade 2",
            enabled: upgrade2.bought
        }))
    ]);

    const upgrade3Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => upgrade4Modifier.apply(Decimal.log10(player.timePlayed).floor()),
            description: "Time Upgrade 3",
            enabled: upgrade3.bought
        }))
    ]);

    const upgrade4Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 1.5,
            description: "Time Upgrade 4",
            enabled: upgrade4.bought
        }))
    ]);

    const upgrade5Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            description: "Time Upgrade 5",
            enabled: upgrade5.bought
        }))
    ]);

    const upgrades = [upgrade1, upgrade2, upgrade3, upgrade4, upgrade5];
    const upgradeModifiers = [upgrade1Modifier, upgrade2Modifier, upgrade3Modifier, upgrade4Modifier, upgrade5Modifier];

    var decayInterval = setInterval(() => {
        if (isHoldingWind) {
            isHoldingWind = false;
            return;
        }
        windProgress.value = Decimal.sub(windProgress.value, 1);
        if (Decimal.lte(windProgress.value, 0)) {
            windProgress.value = 0;
        }
    }, 500 * (upgrade2.bought ? 2 : 1));


    const tabs = createTabFamily(({
        mainTab: () => ({
            tab: createTab(() => ({
                display: jsx(() => (
                    <>
                        {player.devSpeed === 0 ? (
                            <div>
                                Game Paused
                                <Node id="paused" />
                            </div>
                        ) : null}
                        {player.devSpeed != null && player.devSpeed !== 0 && player.devSpeed !== 1 ? (
                            <div>
                                Dev Speed: {format(player.devSpeed)}x
                                <Node id="devspeed" />
                            </div>
                        ) : null}
                        {player.offlineTime != null && player.offlineTime !== 0 ? (
                            <div>
                                Offline Time: {formatTime(player.offlineTime)}
                                <Node id="offline" />
                            </div>
                        ) : null}
                        <div>
                            {Decimal.lt(points.value, "1e1000") ? <span>You have </span> : null}
                            <h2>{format(points.value)}</h2>
                            {Decimal.lt(points.value, "1e1e6") ? <span> seconds of time</span> : null}
                        </div>
                        <h5>Your best time amount is {format(best.value)}s</h5>
                        {Decimal.gt(pointGain.value, 0) ? (
                            <div>
                                ({oomps.value})
                                <Node id="oomps" />
                            </div>
                        ) : null}
                        <Spacer />
                        {render(tree)}
                        <Spacer />
                        {render(winder)}
                        <Spacer />
                        {renderRow(...upgrades)}
                    </>
                )),
            })),
            display: "Main",
            style: { color: "orange" }
        }),
        spaceTab: () => ({
            tab: space.display,
            display: "Space",
            visibility: () => true, //Decimal.gte(points.value, 1e3) || Decimal.gte(space.points.value, 1),
            style: { color: "blue" }
        }),
    }));

    return {
        name: "Tree",
        links: tree.links,
        display: jsx(() => (
            <>
                {render(tabs)}
            </>
        )),
        points,
        best,
        total,
        oomps,
        tree,
        windProgress,
        progressBar,
        windHotkey,
        winder,
        upgrades,
        upgradeModifiers,
        tabs
    };
}); 

/**
 * Given a player save data object being loaded, return a list of layers that should currently be enabled.
 * If your project does not use dynamic layers, this should just return all layers.
 */
export const getInitialLayers = (
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    player: Partial<Player>
): Array<GenericLayer> => [main, timeCondenser, space];

/**
 * A computed ref whose value is true whenever the game is over.
 */
export const hasWon = computed(() => {
    return false;
});

/**
 * Given a player save data object being loaded with a different version, update the save data object to match the structure of the current version.
 * @param oldVersion The version of the save being loaded in
 * @param player The save data being loaded in
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function fixOldSave(
    oldVersion: string | undefined,
    player: Partial<Player>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
): void {}
/* eslint-enable @typescript-eslint/no-unused-vars */
