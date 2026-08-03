import { notFound } from 'next/navigation'
import Link from 'next/link'
import { posts, getPost, formatDate } from '../../../lib/blog-posts'
import type { Metadata } from 'next'

interface Props { params: { slug: string } }

export async function generateStaticParams() {
  return posts.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, images: [post.image] },
  }
}

export default function PostPage({ params }: Props) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const others = posts.filter(p => p.slug !== post.slug).slice(0, 2)

  return (
    <div style={{ background: '#06060a', color: '#e2e8f0', fontFamily: "'Inter',-apple-system,sans-serif", minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        a{text-decoration:none;color:inherit}
        .prose h2{font-size:clamp(20px,2.8vw,26px);font-weight:800;color:#f1f5f9;margin:48px 0 16px;letter-spacing:-0.02em;line-height:1.2}
        .prose h3{font-size:17px;font-weight:700;color:#e2e8f0;margin:32px 0 12px;letter-spacing:-0.01em}
        .prose p{font-size:16px;color:rgba(255,255,255,0.55);line-height:1.85;margin-bottom:20px}
        .prose ul,.prose ol{padding-left:24px;margin-bottom:20px}
        .prose li{font-size:15px;color:rgba(255,255,255,0.5);line-height:1.75;margin-bottom:10px}
        .prose strong{color:rgba(255,255,255,0.8);font-weight:700}
        .prose ol{counter-reset:ol-counter;list-style:none;padding-left:0}
        .prose ol li{counter-increment:ol-counter;padding-left:32px;position:relative}
        .prose ol li::before{content:counter(ol-counter);position:absolute;left:0;top:2px;width:22px;height:22px;background:rgba(124,58,237,0.2);border:1px solid rgba(124,58,237,0.35);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#a78bfa;text-align:center;line-height:22px}
        .prose h2:first-child{margin-top:0}
        .b-nav-back{font-size:13px;color:#a78bfa;font-weight:600;transition:opacity 0.2s}
        .b-nav-back:hover{opacity:0.75}
        .b-wa-btn{font-size:14px;font-weight:700;color:white;padding:13px 24px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c3e);display:inline-flex;align-items:center;gap:8px;transition:opacity 0.2s}
        .b-wa-btn:hover{opacity:0.9}
        .b-related{display:flex;gap:20px;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;padding:20px;background:rgba(255,255,255,0.01);transition:border-color 0.2s;align-items:flex-start}
        .b-related:hover{border-color:rgba(124,58,237,0.2)}
        @media(max-width:700px){
          .b-related-grid{grid-template-columns:1fr!important}
          .post-meta{flex-direction:column!important;gap:8px!important}
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)', background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏢</div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>ConectaAI <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Condominios</span></span>
        </Link>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link href="/blog" className="b-nav-back">← Blog</Link>
          <Link href="https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios" target="_blank"
            style={{ fontSize: 13, fontWeight: 700, color: 'white', padding: '8px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#25d366,#128c3e)' }}>
            Cotizar
          </Link>
        </div>
      </nav>

      {/* HERO IMAGE */}
      <div style={{ width: '100%', height: 'clamp(240px,40vw,420px)', overflow: 'hidden', position: 'relative' }}>
        <img src={post.image} alt={post.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,10,1) 0%, rgba(6,6,10,0.5) 50%, transparent 100%)' }} />
      </div>

      {/* ARTICLE */}
      <article style={{ maxWidth: 740, margin: '0 auto', padding: '0 28px 80px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 40, marginBottom: 24, flexWrap: 'wrap' }} className="post-meta">
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: post.categoryColor, background: `${post.categoryColor}18`, padding: '5px 14px', borderRadius: 100, border: `1px solid ${post.categoryColor}35` }}>
            {post.category}
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>{formatDate(post.date)}</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>·</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>{post.readTime} min de lectura</span>
        </div>

        <h1 style={{ fontSize: 'clamp(26px,4.5vw,42px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#f1f5f9', marginBottom: 24 }}>
          {post.title}
        </h1>

        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 48, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 48 }}>
          {post.excerpt}
        </p>

        <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} />

        {/* CTA INLINE */}
        <div style={{ marginTop: 64, padding: '36px 40px', background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(79,70,229,0.06))', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#a78bfa', marginBottom: 12 }}>ConectaAI Condominios</div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginBottom: 12, lineHeight: 1.3 }}>¿Quieres implementar esto en tu edificio?</h3>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.7 }}>Hablamos de tu caso específico por WhatsApp. Sin costo, sin compromiso.</p>
          <Link href="https://wa.me/56998101891?text=Hola%2C%20quiero%20consultar%20sobre%20ConectaAI%20Condominios" target="_blank" className="b-wa-btn">
            💬 Chatear por WhatsApp
          </Link>
        </div>
      </article>

      {/* RELATED */}
      {others.length > 0 && (
        <section style={{ maxWidth: 1100, margin: '0 auto 80px', padding: '0 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 28 }}>Más artículos</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }} className="b-related-grid">
            {others.map(p => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="b-related">
                <img src={p.image} alt={p.title} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: p.categoryColor, marginBottom: 8 }}>{p.category}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.35 }}>{p.title}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '32px 28px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)' }}>© 2026 ConectaAI · <Link href="/blog" style={{ color: 'rgba(255,255,255,0.3)' }}>← Volver al blog</Link></p>
      </footer>
    </div>
  )
}
