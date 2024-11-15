import { createLayerTreeNode, createResetButton } from "data/common";
import { main } from "data/projEntry";
import { createCumulativeConversion } from "features/conversion";
import { jsx } from "features/feature";
import { createHotkey } from "features/hotkey";
import { createReset } from "features/reset";
import MainDisplay from "features/resources/MainDisplay.vue";
import { createResource } from "features/resources/resource";
import { createTab } from "features/tabs/tab";
import { addTooltip } from "features/tooltips/tooltip";
import { createResourceTooltip } from "features/trees/tree";
import { BaseLayer, createLayer } from "game/layers";
import { noPersist } from "game/persistence";
import { DecimalSource } from "util/bignum";
import { render, renderRow } from "util/vue";
import timeCondenser from "./timeCondenser";
import { createRepeatable } from "features/repeatable";
import { createCostRequirement } from "game/requirements";
import Decimal from "util/bignum";
import Spacer from "components/layout/Spacer.vue";

const id = "space";
const layer: any = createLayer(id, function (this: BaseLayer) {
    const name = "Space";
    const color = "#FF0000";
    const points = createResource<DecimalSource>(0, "space points");

    const conversion = createCumulativeConversion(() => ({
        formula: x => x.div(1).sqrt(),
        baseResource: main.points,
        gainResource: noPersist(points)
    }));

    const reset = createReset(() => ({
        thingsToReset: (): Record<string, unknown>[] => [layer, main, timeCondenser]
    }));

    const treeNode = createLayerTreeNode(() => ({
        layerID: id,
        color,
        reset
    }));

    const tooltip = addTooltip(treeNode, {
        display: createResourceTooltip(points),
        pinnable: true
    });

    const resetButton = createResetButton(() => ({
        conversion,
        tree: main.tree,
        treeNode
    }));

    const hotkey = createHotkey(() => ({
        description: "Reset for space points",
        key: "s",
        onPress: resetButton.onClick
    }));

    const height: any = createRepeatable(() => ({
        display() {
            return {
                title: "Height",
                description: "Increase the height of the space",
            }
        },
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost() {
                let amount = new Decimal(height.amount.value)
                const cost = Decimal.pow(2, amount)
                return cost.floor()
            }
        })),
    }));

    const length: any = createRepeatable(() => ({
        display() {
            return {
                title: "Length",
                description: "Increase the length of the space",
            }
        },
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost() {
                let amount = new Decimal(length.amount.value)
                const cost = Decimal.pow(2, amount).times(5)
                return cost.floor()
            }
        })),
    }));

    const width: any = createRepeatable(() => ({
        display() {
            return {
                title: "Width",
                description: "Increase the width of the space",
            }
        },
        requirements: createCostRequirement(() => ({
            resource: noPersist(points),
            cost() {
                let amount = new Decimal(width.amount.value)
                const cost = Decimal.pow(2, amount).times(10)
                return cost.floor()
            }
        })),
        visibility: () => true
    }));


    const tab = createTab(() => ({
        display: jsx(() => (
            <>
                <MainDisplay resource={points} color={color} />
                {render(resetButton)}
                <Spacer />
                {renderRow(height, length, width)}
                <h3>You have {Decimal.add(height.amount.value, length.amount.value)}m^2 of area</h3>
            </>
        )),
    }));

    return {
        name,
        color,
        points,
        tooltip,
        tab,
        display: tab.display,
        treeNode,
        hotkey,
        reset,
        height,
        length,
        width,
    };
});

export default layer;