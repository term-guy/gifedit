import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import FeatureCard from "../FeatureCard.vue";

describe("FeatureCard", () => {
  it("renders title and content", () => {
    const wrapper = mount(FeatureCard, {
      props: { title: "Test Title", content: "Test content" },
    });

    expect(wrapper.text()).toContain("Test Title");
    expect(wrapper.text()).toContain("Test content");
  });
});
