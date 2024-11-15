/**
 * @module
 * @hidden
 */
import { main } from "data/projEntry";
import HotkeyVue from "components/Hotkey.vue";
import Spacer from "components/layout/Spacer.vue";
import { createBar } from "features/bars/bar";
import { createClickable } from "features/clickables/clickable";
import { jsx } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createReset } from "features/reset";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource, trackTotal } from "features/resources/resource";
import { addTooltip } from "features/tooltips/tooltip";
import { createResourceTooltip } from "features/trees/tree";
import { BaseLayer, createLayer } from "game/layers";
import { noPersist, persistent } from "game/persistence";
import type { DecimalSource } from "util/bignum";
import Decimal, { format } from "util/bignum";
import { Direction } from "util/common";
import { render, renderRow } from "util/vue";
import { createLayerTreeNode } from "../common";
import { createUpgrade } from "features/upgrades/upgrade";
import { createCostRequirement } from "game/requirements";
import { createMultiplicativeModifier, createSequentialModifier } from "game/modifiers";

const id = "C";
// setting the type to any to avoid circular type reference
const layer: any = createLayer(id, function (this: BaseLayer) {
    const name = "Time Condenser";
    const color = "#9900cc";

    const points = createResource<DecimalSource>(0, "s of condensed time");
    const total = trackTotal(points);

    const reset = createReset(() => ({
        thingsToReset: (): Record<string, unknown>[] => [layer]
    }));

    const condenserProgress = persistent<DecimalSource>(0);
    const maxProgress = 10;
    const condenseInterval = 10; // ms
    var canCondense = true;

    const progressBar = createBar(() => ({
        direction: Direction.Right,
        width: 100,
        height: 10,
        style: "margin-top: 8px",
        baseStyle: "margin-top: -1px",
        fillStyle: "margin-top: 0px; transition-duration: 0.1s",
        progress: () => Decimal.div(condenserProgress.value, maxProgress)
    }));

    const condenser = createClickable(() => ({
        display: jsx(() => (
            <h3>
                Condense <HotkeyVue hotkey={condenseHotkey} />
                <Spacer />
                Condense 1000s of time into {condense().toString()}s of condensed time.
                <Spacer />
                {render(progressBar)}
            </h3>
        )),
        canClick: () => Decimal.gte(main.points.value, 1000),
        onClick: () => {
            if (!canCondense) return
            condenserProgress.value = Decimal.add(condenserProgress.value, 1);

            canCondense = false;
            setTimeout(() => {
                canCondense = true;
            }, condenseInterval * (upgrade2.bought ? 0.5 : 1));

            if (Decimal.gte(condenserProgress.value, maxProgress)) {
                main.points.value = Decimal.sub(main.points.value, 1000);

                var gain = condense();
                points.value = Decimal.add(points.value, gain);

                condenserProgress.value = 0;
            }
        }
    }));

    function condense() {
        var gain = upgrade3Modifier.apply(1);
        gain = main.upgradeModifiers[4].apply(gain);

        return gain;
    }

    const upgrade1 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 1
        })),
        display: {
            description: "Condensed time boosts normal time gain.",
        }
    }));

    const upgrade1Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => upgrade4Modifier.apply(Decimal.pow(points.value, 0.5)),
            enabled: upgrade1.bought
        }))
    ]);

    const upgrade2 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 3
        })),
        display: {
            description: "You condense and gain time 2x faster.",
        }
    }));

    const upgrade2Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: 2,
            enabled: upgrade2.bought
        }))
    ]);

    const upgrade3 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 10
        })),
        display: {
            description: "Your condenser produces more condensed time based on you best time earned.",
        }
    }));

    const upgrade3Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.log(main.best.value, 50).round(),
            enabled: upgrade3.bought
        }))
    ]);

    const upgrade4 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 75
        })),
        display: {
            description: "Boost condenser upgrade 1's effect significantly based on total condensed time made.",
        }
    }));

    const upgrade4Modifier = createSequentialModifier(() => [
        createMultiplicativeModifier(() => ({
            multiplier: () => Decimal.pow(total.value, 0.25),
            enabled: upgrade4.bought
        }))
    ]);

    const upgrade5 = createUpgrade(() => ({
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost: 500
        })),
        display: {
            description: "The power generator can be wound twice as much.",
        }
    }));

    const row1Upgrades = [
        upgrade1,
        upgrade2,
        upgrade3,
        upgrade4,
        upgrade5,
    ]

    const row1UpgradeModifiers = [
        upgrade1Modifier,
        upgrade2Modifier,
    ]

    const treeNode = createLayerTreeNode(() => ({
        visibility: () => Decimal.gte(main.points.value, 1000) || Decimal.gte(points.value, 1),
        layerID: id,
        color,
        reset
    }));
    const tooltip = addTooltip(treeNode, {
        display: createResourceTooltip(points),
        pinnable: true
    });

    const condenseHotkey = createHotkey(() => ({
        description: "Condense time",
        key: "c",
        onPress() {
            condenser.onClick();
        }
    }));

    return {
        name,
        color,
        points,
        total,
        tooltip,
        row1Upgrades,
        row1UpgradeModifiers,
        display: jsx(() => (
            <>
                <MainDisplay resource={points} color={color} />
                <h5>You have made {format(total.value)}s of condensed time.</h5>
                <Spacer />
                {render(condenser)}
                {renderRow(...row1Upgrades)}
            </>
        )),
        treeNode,
        condenser,
        condenserProgress,
        condenseHotkey,
    };
});

export default layer;