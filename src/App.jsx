import { demos } from "./demos/index.js";

function Header() {
  return (
    <header className="site-header" aria-label="Site header">
      <a className="brand" href="/" aria-label="Paqui04 Playground home">
        <span className="brand-mark" aria-hidden="true">
          P4
        </span>
        <span>Paqui04 Playground</span>
      </a>
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#demos">Demos</a>
        <a href="https://github.com/Paqui04" rel="noreferrer" target="_blank">
          GitHub
        </a>
      </nav>
    </header>
  );
}

function EmptyState() {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-icon" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <h2 id="empty-title">No demos yet</h2>
        <p>
          This playground is ready for interactive experiments. New demos can be
          added as isolated entries with a title, description, tags, and route.
        </p>
      </div>
    </section>
  );
}

function DemoCard({ demo }) {
  return (
    <article className="demo-card">
      {demo.preview ? (
        <img src={demo.preview} alt="" className="demo-preview" />
      ) : null}
      <div className="demo-card-content">
        <h3>{demo.title}</h3>
        <p>{demo.description}</p>
        <div className="tag-list" aria-label={`${demo.title} tags`}>
          {demo.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <a className="demo-link" href={demo.route}>
          Open demo
        </a>
      </div>
    </article>
  );
}

function DemoCatalog() {
  return (
    <section className="catalog-section" id="demos" aria-labelledby="demos-title">
      <div className="section-heading">
        <p className="section-label">Catalog</p>
        <h2 id="demos-title">Interactive demos</h2>
        <p>
          A growing collection of small web experiments, tools, and visual
          prototypes.
        </p>
      </div>

      {demos.length > 0 ? (
        <div className="demo-grid">
          {demos.map((demo) => (
            <DemoCard demo={demo} key={demo.route} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <h1 id="page-title">Interactive web experiments by Paqui04.</h1>
            <p>
              A personal GitHub Pages playground for testing ideas, building
              small tools, and publishing polished browser demos.
            </p>
            <a className="primary-action" href="#demos">
              View catalog
            </a>
          </div>
          <div className="hero-panel" aria-hidden="true">
            <div className="panel-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="panel-lines">
              <span className="line-wide" />
              <span />
              <span className="line-short" />
              <span className="line-wide" />
            </div>
            <div className="panel-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
        <DemoCatalog />
      </main>
    </div>
  );
}
