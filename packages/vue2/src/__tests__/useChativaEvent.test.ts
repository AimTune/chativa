import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { EventBus } from "@chativa/core";
import { useChativaEvent } from "../composables/useChativaEvent";

describe("useChativaEvent", () => {
  it("subscribes for the component's lifetime", () => {
    const handler = vi.fn();
    const Comp = defineComponent({
      setup() {
        useChativaEvent("history_loaded", handler);
        return () => h("div");
      },
    });

    const wrapper = mount(Comp);
    EventBus.emit("history_loaded", { count: 3 });
    expect(handler).toHaveBeenCalledWith({ count: 3 });

    wrapper.destroy();
    EventBus.emit("history_loaded", { count: 4 });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
