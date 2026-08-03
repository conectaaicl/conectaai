import Link from 'next/link'
import { posts, formatDate } from '../../lib/blog-posts'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — Gestión de condominios, tecnología y comunidad',
  description: 'Guías prácticas, actualización legal y tendencias tecnológicas para administradores de condominios en Latinoamérica.',
}

export default function BlogPage() {
  const [featured, ...rest] = posts

  return (
    <div style={{ background: '#06060a', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        .b-feat{display:grid;grid-template-columns:1fr 1fr;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden;transition:border-color 0.2s}
        .b-feat:hover{border-color:rgba(124,58,237,0.3)}
        .b-feat:hover .b-img{transform:scale(1.04)}
        .b-img{width:100%;height:100%;object-fit:cover;transition:transform 0.5s ease}
        .b-card{display:block;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;transition:border-color 0.2s,transform 0.2s;background:rgba(255,255,255,0.01)}
        .b-card:hover{border-color:rgba(124,58,237,0.3);transform:translateY(-3px)}
        .b-card:hover .b-img{transform:scale(1.04)}
        .b-nav-link{font-size:13px;color:rgba(255,255,255,0.4);transition:color 0.2s}
        .b-nav-link:hover{color:#fff}
        .b-back{font-size:13px;color:#a78bfa;font-weight:600;transition:opacity 0.2s}
        .b-back:hover{opacity:0.75}
        .b-cta-btn{font-size:13px;font-weight:700;color:white;padding:8px 18px;border-radius:10px;background:linear-gradient(135deg,#25d366,#128c3e);transition:opacity 0.2s}
        .b-cta-btn:hover{opacity:0.9}
        .b-all-btn{font-size:13.5px;font-weight:600;color:#a78bfa;display:flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid rgba(124,58,237,0.3);border-radius:10px;transition:background 0.2s;white-space:nowrap}
        .b-all-btn:hover{background:rgba(124,58,237,0.1)}
        @media(max-width:860px){
          .b-feat{grid-template-columns:1fr!important}
          .b-feat-img{height:240px!important}
          .b-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>ConectaAI <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Condominios</span></span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/#funcionalidades" className="b-nav-link">Funcionalidades</Link>
          <Link href="/blog" style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Blog</Link>
          <Link href="https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios" target="_blank" className="b-cta-btn">
            Cotizar
          </Link>
        </div>
      </nav>

      {/* HEADER */}
      <header style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 28px 48px' }}>
        <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#a78bfa', textTransform: 'uppercase', marginBottom: 20, padding: '5px 14px', background: 'rgba(124,58,237,0.08)', borderRadius: 100, border: '1px solid rgba(124,58,237,0.2)' }}>
          Blog
        </div>
        <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, color: '#f1f5f9', marginBottom: 16 }}>
          Guías y tendencias para<br />
          <span style={{ background: 'linear-gradient(135deg,#a78bfa,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            administradores modernos
          </span>
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', maxWidth: 520, lineHeight: 1.7 }}>
          Actualización legal, tecnología de acceso, finanzas y comunicación para la comunidad de tu edificio.
        </p>
      </header>

      {/* FEATURED */}
      <section style={{ maxWidth: 1100, margin: '0 auto 64px', padding: '0 28px' }}>
        <Link href={`/blog/${featured.slug}`} className="b-feat">
          <div style={{ overflow: 'hidden', height: 380 }} className="b-feat-img">
            <img src={featured.image} alt={featured.title} className="b-img" />
          </div>
          <div style={{ padding: '48px 44px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: featured.categoryColor, background: `${featured.categoryColor}18`, padding: '4px 12px', borderRadius: 100, border: `1px solid ${featured.categoryColor}35` }}>
                {featured.category}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Destacado</span>
            </div>
            <h2 style={{ fontSize: 'clamp(18px,2.5vw,26px)', fontWeight: 800, lineHeight: 1.25, color: '#f1f5f9', marginBottom: 16 }}>{featured.title}</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 32 }}>{featured.excerpt}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{formatDate(featured.date)}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>{featured.readTime} min de lectura</span>
            </div>
          </div>
        </Link>
      </section>

      {/* GRID */}
      <section style={{ maxWidth: 1100, margin: '0 auto 100px', padding: '0 28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }} className="b-grid">
          {rest.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="b-card">
              <div style={{ height: 200, overflow: 'hidden' }}>
                <img src={post.image} alt={post.title} className="b-img" />
              </div>
              <div style={{ padding: '24px 24px 28px' }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: post.categoryColor, background: `${post.categoryColor}18`, padding: '3px 10px', borderRadius: 100, border: `1px solid ${post.categoryColor}35` }}>
                  {post.category}
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: '#e2e8f0', marginBottom: 10, marginTop: 14 }}>{post.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.65, marginBottom: 20 }}>{post.excerpt.slice(0, 120)}…</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{formatDate(post.date)}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>·</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{post.readTime} min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© 2026 ConectaAI · <Link href="/" style={{ color: 'rgba(255,255,255,0.3)' }}>Volver al inicio</Link></p>
      </footer>
    </div>
  )
}
