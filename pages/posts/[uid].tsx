// REACT
import {
	useEffect,
	SetStateAction,
	useState,
	Dispatch,
	RefObject,
	useRef,
	useContext,
	MouseEvent,
} from 'react'

// NEXT
import { NextPage, NextPageContext } from 'next'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'

// PRISMIC
import { Document } from 'prismic-javascript/d.ts/documents'
import PrismicClient from 'prismic-configuration'

// ANIMACIONES
import { motion, Variants } from 'framer-motion'

// COMPONENTES
// @ts-ignore
import { RichText } from 'prismic-reactjs'
import Meta from 'components/Meta'
import { DiscussionEmbed } from 'disqus-react'

// HERRAMIENTAS
import {
	formateDate,
	getLikesAverage,
	calculateScrollDistance,
	copyPath,
	sendLikes,
} from 'utils/Tools'
import { findByUID } from 'utils/LocalDB'

// CONTEXTO
import { appContext } from 'context/appContext'
import fetchPosts from 'utils/Prismic'

// INTERFAZ DE ESTADO
interface PostState {
	likesAverage: string
	post: Document | undefined
	subtitles: NodeListOf<HTMLHeadingElement> | undefined
}

// PROPIEDADES INICIALES
interface PostProps {
	post: Document
}

// ANIMACIONES
const PostPageVariant: Variants = {
	init: { y: -100, opacity: 0 },
	in: { y: 0, opacity: 1, transition: { delay: 0.5 } },
}

// ESTADO INICIAL
const DefState: PostState = {
	likesAverage: '0',
	post: undefined,
	subtitles: undefined,
}

const Post: NextPage<PostProps> = ({ post }) => {
	// CONTEXTO
	const { docs, lang, setDocs, darkMode } = useContext(appContext)

	// REFERENCIAS
	const progressScroll: RefObject<HTMLProgressElement> = useRef(null)

	// BUSCAR POR ID
	const uid: string = useRouter().asPath.substr(7)
	DefState.post = docs ? findByUID(uid, docs) : undefined

	// ESTADO DEL POST
	const [state, setState]: [PostState, Dispatch<SetStateAction<PostState>>] = useState(DefState)

	useEffect(() => {
		// SCROLL
		window.addEventListener('scroll', () => {
			if (progressScroll.current) progressScroll.current.value = window.scrollY
		})

		// ENVIAR DOCUMENTOS
		setTimeout(() => {
			if (post && !docs?.length)
				fetchPosts().then((fDocs: Document[]) =>
					// GUARDAR EN LOCAL
					setDocs(fDocs)
				)
		}, 3000)
	}, [])

	// PLUGIN DE LIKES DE LIKES
	sendLikes(uid)

	useEffect(() => {
		setState({ ...state, post: docs ? findByUID(uid, docs) : undefined })
	}, [uid])

	// POST ACTUAL
	const sPost: Document | undefined = post || state.post

	useEffect(() => {
		if (sPost) {
			// ACTUALIZAR PROGRESS BAR
			if (progressScroll.current) progressScroll.current.max = calculateScrollDistance()

			// OBTENER INDICES
			const subtitles: NodeListOf<HTMLHeadingElement> = document.querySelectorAll(
				'.post-page-main > h2'
			) as NodeListOf<HTMLHeadingElement>

			// ACTUALIZAR ESTADO
			setState({ ...state, subtitles })
		}
	}, [sPost, state.likesAverage])

	// RENDERIZAR
	useEffect(() => {
		// RENDERIZADO
		const mainC: HTMLDivElement | null = document.querySelector('.post-page-main')

		// VERIFICAR TEXTOS
		if (mainC) {
			// OBTENER
			const mainChildren: NodeListOf<ChildNode> = mainC.childNodes

			// RECORRER HIJOS
			mainChildren.forEach((msChild: ChildNode) => {
				const mChild: HTMLElement = msChild as HTMLElement

				// SALTOS DE LINEA
				if (mChild.tagName === 'P' && mChild.textContent === '') {
					const br: HTMLBRElement = document.createElement('br')
					if (mChild.hasChildNodes()) mChild.childNodes[0].replaceWith(br)
					else mChild.appendChild(br)
				}

				// CÓDIGO EN GIST
				if (mChild.getAttribute('data-oembed')?.includes('github')) {
					// URL DEL GIST
					const dataLink: string = mChild.getAttribute('data-oembed') || ''
					const iframeOrDiv = mChild.childNodes[0] as HTMLElement

					// ACTUALIZAR CLASS NAME EN DARKMODE
					if (iframeOrDiv.tagName === 'IFRAME')
						mChild.classList.value = darkMode ? 'darkGist' : 'lightGist'
					// SINO CREAR IFRAME
					else {
						// CREAR ELEMENTO
						const iGFrame = document.createElement('iframe')

						// AGREGAR PROPIEDADES
						iGFrame.classList.value = darkMode ? 'darkGist' : 'lightGist'
						iGFrame.setAttribute('data-oembed', dataLink)

						// CREAR DOCUMENTO HTML
						iGFrame.src = `data:text/html;charset=utf-8,
					<head><base target='_blank' /></head>
					<body><script src='${dataLink}'></script>
					</body>`

						// REMPLAZAR NODO
						if (mChild.hasChildNodes()) mChild.childNodes[0].replaceWith(iGFrame)
						else mChild.appendChild(iGFrame)
					}
				}
			})
		}
	}, [darkMode, sPost])

	// OBTENER LIKES
	getLikesAverage(uid, [state.subtitles, sPost], (likesAverage: string) =>
		setState({ ...state, likesAverage })
	)

	// AVANZAR A SECCIONES
	const goTo = (h: HTMLHeadingElement) => {
		// OBTENER DIMENSIONES
		const scroll: number = h.getBoundingClientRect().top
		const navHeight: number = parseInt(
			getComputedStyle(document.body).getPropertyValue('--navHeight').replace('px', ''),
			10
		)

		// AVANZAR
		window.scrollTo({
			top: window.scrollY + (scroll - navHeight - 10),
			behavior: 'smooth',
		})
	}

	// FUNCIONES PARA SCROLL
	const linkResolvers = state.subtitles
		? Array.from(state.subtitles).map((subtitle: HTMLHeadingElement) => () => goTo(subtitle))
		: []

	// COMPARTIR EN FACEBOOK
	const shareBtn = (ev: MouseEvent<HTMLAnchorElement>) => {
		if (navigator.share) {
			ev.preventDefault()

			navigator
				.share({
					title: RichText.asText(sPost.data.title),
					text: `Mira este artículo sobre ${sPost.tags.join(', ')}`,
					url: window.location.href,
				})
				.then(() => console.log('Successfully share'))
				.catch((error: Error) => console.log('Error sharing', error))
		}
	}

	// COPIAR URL
	const copyPaths = (e: any) => copyPath(e, lang.postPage.toast)

	// META TAGS
	const title: string = sPost
		? RichText.asText(sPost.data.title)
		: 'Error al cargar el artículo (404)'
	const description: string = sPost
		? sPost.data.description
		: 'Lo sentimos no hemos podido encontrar el post, intenta verificar la dirección o intenta nuevamente.'

	// COMPONENTE
	return (
		<section className='page post'>
			<progress ref={progressScroll} className='post-progress' value='0' />
			<Head>
				<title>{title}</title>
				<Meta
					title={`${lang.navbar} - ${title}`}
					desc={sPost ? RichText.asText(description) : description}
					banner={sPost?.data.banner.url || ''}
					url={`posts/${sPost?.uid || ''}`}
					keys={['LUA', 'blog'].concat(sPost?.tags || [''])}
				/>
			</Head>
			{sPost && (
				<motion.div initial='init' animate='in' exit='in' variants={PostPageVariant}>
					<div className='post-page-content'>
						<Link as='/' href='/' passHref>
							<a title='Regresar' className='post-page-back'>
								<i className='lni lni-chevron-left' />
							</a>
						</Link>

						<div className='post-page-header'>
							<img src={sPost.data.banner.url} alt='Post Banner' className='post-banner' />
						</div>

						<div className='post-page-container'>
							<div className='post-page-content-text'>
								<h1>{title}</h1>
								<div className='post-page-head'>
									<span>{formateDate(sPost.first_publication_date, sPost.data.author)}</span>
								</div>

								<div className='post-page-desc'>{RichText.render(description)}</div>
								<div className='post-page-main'>{RichText.render(sPost.data.content)}</div>

								<h2 className='post-page-likes-title'>
									{lang.postPage.likes}
									<span>{state.likesAverage}</span> <i className='lni lni-star-filled' />
								</h2>
								<div className='post-page-likes'>
									<ul>
										{'likes'.split('').map((_char: string, key: number) => (
											<li key={key} data-like={key}>
												<i className='lni lni-star' data-like={key} />
											</li>
										))}
									</ul>
									<ul>
										<li>
											<a
												href='https://twitter.com/weareluastudio?lang=es'
												title='@weareluastudio'
												target='_blank'
												rel='noreferrer noopener'>
												<i className='lni lni-twitter' />
											</a>
										</li>
										<li>
											<a
												href='https://www.linkedin.com/company/weareluastudio/'
												title='Linkedin - LUA Development Studio'
												target='_blank'
												rel='noreferrer noopener'>
												<i className='lni lni-linkedin' />
											</a>
										</li>
										<li>
											<a
												onClick={shareBtn}
												href='https://www.facebook.com/weareluastudio'
												title='Facebook - LUA Development Studio'
												target='_blank'
												rel='noreferrer noopener'>
												<i className='lni lni-facebook' />
											</a>
										</li>
										<li>
											<a onClick={copyPaths} href='#copy' title='Copiar URL' target='_blank'>
												<i className='lni lni-link' />
											</a>
										</li>
									</ul>
								</div>
								<DiscussionEmbed
									shortname='weareluastudio'
									config={{
										url: `https://blog.wearelua.com/posts/${sPost.uid}`,
										identifier: sPost.uid,
										title: RichText.asText(sPost.data.title),
										language: 'es_MX',
									}}
								/>
							</div>
							<div className='post-page-index'>
								<div className='post-page-index-list'>
									<h2>{lang.postPage.subtitle}</h2>
									<ul>
										{state.subtitles &&
											Array.from(state.subtitles).map((subtitle: HTMLHeadingElement, i: number) => (
												<li key={i}>
													<a
														href={`#${subtitle.textContent}`}
														title={subtitle.textContent || ''}
														onClick={linkResolvers[i]}>
														{subtitle.textContent}
													</a>
												</li>
											))}
									</ul>
								</div>
							</div>
						</div>
					</div>
				</motion.div>
			)}
			<style jsx>{`
				.post-progress {
					appearance: none;
					border: none;
					outline: none;
					background: transparent;
					height: 3px;
					position: fixed;
					top: 0;
					left: 0;
					width: 100%;
					z-index: 5;
				}

				.post-page-content {
					position: relative;
					max-width: 1300px;
					width: calc(100% - 140px);
					margin: 0 auto;
				}

				.post-page-content > * {
					color: var(--postText);
					font-family: 'OpenSans';
				}

				.post-page-back {
					position: relative;
					margin-top: 10px;
					font-size: 1.5em;
					display: inline-flex;
					align-items: center;
				}

				.post-page-back::before {
					content: '';
					position: absolute;
					right: -10px;
					width: 26px;
					height: 2px;
					background: var(--postText);
				}

				.post-page-header {
					width: 100%;
					height: 350px;
					margin: 20px 0;
				}

				.post-page-header > img {
					width: 100%;
					height: 100%;
					object-fit: cover;
					border-radius: 10px;
				}

				.post-page-container {
					display: flex;
					justify-content: space-between;
				}

				.post-page-content-text {
					width: 100%;
					margin-bottom: 30px;
				}

				.post-page-content-text > h1 {
					font-weight: 600;
					font-size: 2em;
				}

				.post-page-head {
					margin: 10px 0;
				}

				.post-page-head > span {
					color: var(--postText);
					font-weight: 500;
					font-family: 'Manrope';
					opacity: 0.6;
				}

				.post-page-container > .post-page-index {
					height: 100%;
					margin-left: 80px;
					display: flex;
					flex-direction: column;
					align-items: flex-end;
				}

				.post-page-index-list {
					position: relative;
					color: var(--postText);
					width: 300px;
					border-radius: 10px;
					padding: 10px 60px;
					box-shadow: 5px 5px 15px rgba(0, 0, 0, 0.05);
					margin-bottom: 30px;
					overflow: hidden;
				}

				.post-page-index-list::before {
					content: '';
					width: 100%;
					height: 100%;
					position: absolute;
					top: 0;
					left: 0;
					background: var(--navbarBackground);
					z-index: -2;
					transition: background 0.3s ease-in-out;
				}

				.post-page-index-list::after {
					content: '';
					width: 100%;
					height: 100%;
					position: absolute;
					top: 0;
					left: 0;
					background: var(--shadow);
					z-index: -1;
				}

				.post-page-index-list > h2 {
					text-align: center;
					font-weight: 500;
					margin-bottom: 35px;
					margin-top: 10px;
					font-size: 1.4em;
				}

				.post-page-index-list > ul {
					list-style: initial;
				}

				.post-page-index-list > ul > li {
					margin-bottom: 20px;
				}

				.post-page-index-list > ul > li > a {
					color: var(--postText);
				}

				.post-page-likes-title{
					margin-top: 30px;
					margin-bottom: 10px;
					display: flex;
					align-items: center;
					font-family: 'Manrope'
					color: var(--postText);
					font-size: 1.1em;
					opacity: 0.7;
					font-weight: 400;
				}

				.post-page-likes-title > span{
					font-weight: 500;
					margin:0 10px;
				}

				.post-page-likes-title > i{
					cursor: pointer;
				}

				.post-page-likes {
					width: 100%;
					margin-bottom: 30px;
					padding-bottom: 10px;
					border-bottom: 2px solid var(--postText);
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.post-page-likes > ul:first-child {
					display: flex;
					margin-left: -5px;
				}

				.post-page-likes > ul:last-child {
					display: flex;
				}

				.post-page-likes > ul:last-child > li {
					margin-left: 10px;
				}

				.post-page-likes > ul:last-child > li:nth-child(3){
					margin-left: 5px;
					margin-right: -5px;
				}

				.post-page-likes > ul:last-child > li > a {
					color: var(--postText);
				}

				.post-page-likes > ul:last-child > li > a > i {
					font-size: 1.8em;
				}

				@media screen and (max-width: 1000px) {
					.post-page-container > .post-page-index {
						margin-left: 30px;
					}
				}

				@media screen and (max-width: 950px) {
					.post-page-container > .post-page-index {
						display: none;
					}

					.post-page-content {
						width: calc(100% - 100px);
					}
				}

				@media screen and (max-width: 760px) {
					.post-page-footer > span {
						width: 330px;
					}

					.post-page-likes > ul:first-child > li {
						width: 45px;
					}

					.post-page-back::before {
						right: -12px;
					}
				}

				@media screen and (max-width: 700px) {
					.post-page-header {
						height: 300px;
					}
				}

				@media screen and (max-width: 600px) {
					.post-page-header {
						height: 200px;
					}
				}

				@media screen and (max-width: 500px) {
					.post-page-footer > img {
						width: 70px;
					}

					.post-page-header {
						height: 150px;
					}

					.post-page-footer {
						width: 100%;
						justify-content: flex-start;
					}

					.post-page-footer > span {
						font-size: 0.9em;
						width: 250px;
						margin-left: 20px;
					}

					.post-page-likes > ul:first-child > li {
						width: 30px;
					}

					.post-page-likes > ul:last-child > li > a > i {
						font-size: 1.5em;
					}
				}

				@media screen and (max-width: 460px) {
					.post-page-back::before {
						right: -14px;
					}
					.post-page-content {
						width: calc(100% - 60px);
					}
				}
			`}</style>
			<style jsx global>{`
				.post-page-desc > * {
					font-family: 'OpenSans';
					color: var(--postText);
					font-weight: 500;
					font-size: 1.2em;
					line-height: 20px;
					opacity: 0.7;
				}

				.post-page-main > * {
					font-family: 'OpenSans';
					color: var(--postText);
					font-size: 1.1em;
					opacity: 0.7;
					line-height: 20px;
				}

				.post-page-main > h2 {
					margin: 15px 0;
					font-size: 1.7em;
					opacity: 0.9;
					font-weight: bold;
				}

				.post-page-main > h3 {
					margin: 15px 0;
					font-size: 1.4em;
					opacity: 0.9;
					font-weight: bold;
				}

				.post-page-main > div > iframe {
					width: 100%;
					min-height: 250px;
					opacity: 1;
					border: none;
					outline: none;
					margin: 25px 0;
					transition: filter 0.3s ease-in-out;
				}

				#disqus_thread > iframe {
					border-radius: 10px;
					padding: 30px;
					background: #0d091d;
				}

				.post-page-likes > ul:first-child > li i {
					font-size: 1.6em;
					cursor: pointer;
					padding: 0 10px;
				}

				@media screen and (max-width: 500px) {
					.post-page-likes > ul:first-child > li > i {
						padding: 0 5px;
					}
				}
			`}</style>
		</section>
	)
}

Post.getInitialProps = async ({ res, req }: NextPageContext) => {
	// CONFIGURAR SPR VERCEL
	if (res) res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate')

	// OBTENER PARAMS
	const param: string = req?.url?.substr(req?.url?.lastIndexOf('/') + 1) || ''

	// OBTENER DOCUMENTO POR UID
	const post: Document = await PrismicClient.getByUID('post', param, {})

	// RETORNAR POST Y PREVIEW
	return { post }
}

export default Post
