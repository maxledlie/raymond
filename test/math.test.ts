import { assert } from "@esm-bundle/chai";
import { mat3_inverse, mat3_equal, mat3_mul } from "../src/math";

it("inverts a 3x3 matrix", () => {
    const mat = [
        [1, 2, 3],
        [4, 5, 4],
        [3, 2, 1],
    ];
    const inv = mat3_inverse(mat);
    const expected = mat3_mul(
        [
            [3, -4, 7],
            [-8, 8, -8],
            [7, -4, 3],
        ],
        1 / 8
    );
    assert.isDefined(inv);
    assert.isTrue(mat3_equal(inv!, expected));
});
