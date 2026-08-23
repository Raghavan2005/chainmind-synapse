(function () {
  const pages = [
    ["INDEX.html", "Index"],
    ["prd.html", "PRD"],
    ["PROPOSAL.html", "Proposal"],
    ["REQUIREMENTS.html", "Requirements"],
    ["architecture.html", "Architecture"],
    ["PLAN.html", "Plan"],
    ["MATH.html", "Math"],
    ["RESEARCH.html", "Research"],
    ["REPOS.html", "Repos"],
    ["INTEGRATION.html", "Integrate"],
    ["SCHEMA.html", "Schema"],
    ["PROMPTS.html", "Prompts"],
    ["AGENTS.html", "Agents"],
    ["SKILL.html", "Skills"],
    ["DESIGN.html", "Design"],
    ["CLAUDE.html", "Claude"],
  ];

  const here = (location.pathname.split("/").pop() || "INDEX.html").toLowerCase();

  const brand = document.querySelector("[data-mast]");
  if (brand) {
    brand.innerHTML = `
      <div class="brand">
        <span class="mark" aria-hidden="true">◎</span>
        <div>
          <strong>ChainMind Synapse</strong>
          <span>Vibe-coding dossier · 6-hour testnet build</span>
        </div>
      </div>
      <nav class="primary" aria-label="Dossier">
        ${pages
          .map(([href, label]) => {
            const current = href.toLowerCase() === here ? ' aria-current="page"' : "";
            return `<a href="${href}"${current}>${label}</a>`;
          })
          .join("")}
      </nav>`;
  }

  const toc = document.querySelector("[data-toc]");
  const main = document.querySelector("main");
  if (toc && main) {
    const heads = [...main.querySelectorAll("h2[id]")];
    toc.innerHTML =
      "<h2>On this page</h2>" +
      heads
        .map((h) => `<a href="#${h.id}">${h.textContent}</a>`)
        .join("");
    const links = [...toc.querySelectorAll("a")];
    const sync = () => {
      let active = links[0];
      for (const h of heads) {
        if (h.getBoundingClientRect().top < 90) {
          active = links.find((a) => a.getAttribute("href") === `#${h.id}`);
        }
      }
      links.forEach((a) => a.classList.toggle("active", a === active));
    };
    document.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  const foot = document.querySelector("[data-foot]");
  if (foot) {
    foot.innerHTML = `ChainMind Synapse dossier · sourced from <code>prd.md</code> and <code>research-existing-solutions.md</code> · GitHub links verified with <code>gh repo view</code> on 2026-08-23 · Goerli/Mumbai are dead; use Sepolia + Polygon Amoy · do not use commercial identity-reconciliation SDKs.`;
  }
})();
