// Modified for Nation Builder (Flashpoint History), 2026 — see NOTICE.md.
import { assert } from "../src/debugAssert";

declare var global: any;

describe("the debug asserter", () => {

    let globalAlert: any;

    beforeEach(() => {
        globalAlert = global.alert;
        global.alert = vi.fn().mockName("alert");
    });

    afterEach(() => {
        global.alert = globalAlert;
    });

    it("should alert when the assertion fails", () => {
        const message = "foo";

        assert(false, message);

        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining(message));
    });

    it("should not alert when the assertion succeeds", () => {
        const message = "foo";

        assert(true, message);

        expect(global.alert).not.toHaveBeenCalled();
    });
});
