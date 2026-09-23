import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AddCenterPage from "./AddCenterPage";

describe("AddCenterPage", () => {
  it("renders Center Information section", () => {
    render(
      <MemoryRouter>
        <AddCenterPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Center Information/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Full Center Name/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/SCRE-001/i)).toBeTruthy();
  });

  it("renders Certificate Branding Assets inputs", () => {
    render(
      <MemoryRouter>
        <AddCenterPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Certificate Branding Assets/i)).toBeTruthy();
    const urlInputs = screen.getAllByPlaceholderText(/https:\/\/\.\.\./i);
    expect(urlInputs.length).toBeGreaterThanOrEqual(3);
  });
});
