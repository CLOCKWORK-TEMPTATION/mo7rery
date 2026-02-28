<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Request Config | Axios Docs</title>
    <link rel="stylesheet" href="/style/index.css" />
    <link rel="stylesheet" href="/style/post.css" />
    <link rel="stylesheet" href="/style/sponsors.css" />
    <style>
      * {
        
      }
    </style>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css"
      integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X"
      crossorigin="anonymous"
    />
    <link
      rel="preload"
      as="style"
      onload="this.rel='stylesheet'"
      href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400;1,500;1,700&display=swap"
    />

    <link rel="shortcut icon" href="/assets/favicon.ico" type="image/x-icon" />
    <script src="https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide.min.css">
    <script src="https://cdn.jsdelivr.net/npm/@splidejs/splide-extension-auto-scroll@0.5.3/dist/js/splide-extension-auto-scroll.min.js"></script>
    <script src="https://unpkg.com/@popperjs/core@2"></script>
    <script src="https://unpkg.com/tippy.js@6"></script>

  </head>

  <body>
    <script>
      let isDarkThemeActive = false;
      const THEME_TIMEOUT = 24 * 3600; // 24 hours
      const userDefaultTheme = localStorage.getItem("@axios-docs:theme");
      const userTS = +localStorage.getItem("@axios-docs:ts");
      const darkQuery = "(prefers-color-scheme: dark)";
      const darkMQL = window.matchMedia ? window.matchMedia(darkQuery) : {};

      if (
         ((!userTS || (Date.now() - userTS) / 1000 > THEME_TIMEOUT) && darkMQL.media === darkQuery) ||
         (userDefaultTheme && userDefaultTheme === "true")
      ) {
        document.body.classList.add("dark");
        isDarkThemeActive = true;
      }

      localStorage.setItem("@axios-docs:ts", Date.now());

      const updateImagesTheme = (isDark) => {
        const attrName = 'data-dark';
        const pics = document.querySelectorAll('img');

        pics.forEach(image => {
          const darkSource = image.getAttribute(attrName);
          if (darkSource && image.src) {
            if (isDark) {
              image.setAttribute('data-light', image.getAttribute('src'));
              image.src = darkSource;
            } else {
              image.src = image.getAttribute('data-light');
            }
          }
        });
      }

    </script>
    <header>
      <div></div>
      <div class="left">
        <button id="hamburger">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            id="hamburgerIcon"
          >
            <path d="M3 8V6H21V8H3Z" fill="currentColor" />
            <path d="M3 13H21V11H3V13Z" fill="currentColor" />
            <path d="M3 18H21V16H3V18Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>
    <aside>
      <div>
        <a href="/" id="logo">
          <svg width="188" height="28" viewBox="0 0 188 28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M93.295 3.65206L86.356 9.30495H90.8876V27.68L93.295 25.7411V3.65206Z" fill="currentColor"/>
            <path d="M95.295 24.0997L102.356 18.305H97.6975V0.350052L95.295 2.02275V24.0997Z" fill="currentColor"/>
            <path d="M182.695 6.95295C183.495 7.36895 184.071 7.72095 184.423 8.00895L186.919 3.25695C185.671 2.48895 184.167 1.80095 182.407 1.19295C180.679 0.584955 178.807 0.280952 176.791 0.280952C174.871 0.280952 173.095 0.600952 171.463 1.24095C169.863 1.88095 168.583 2.82495 167.623 4.07295C166.695 5.32095 166.231 6.87295 166.231 8.72895C166.231 10.809 166.887 12.409 168.199 13.529C169.543 14.617 171.591 15.513 174.343 16.217C176.551 16.793 178.327 17.321 179.671 17.801C181.047 18.249 181.735 19.001 181.735 20.057C181.735 21.625 180.263 22.409 177.319 22.409C175.847 22.409 174.455 22.233 173.143 21.881C171.831 21.529 170.679 21.097 169.687 20.585C168.727 20.073 168.039 19.609 167.623 19.193L165.031 24.233C166.695 25.289 168.599 26.121 170.743 26.729C172.887 27.337 175.047 27.641 177.223 27.641C179.111 27.641 180.871 27.385 182.503 26.873C184.135 26.329 185.447 25.465 186.439 24.281C187.463 23.065 187.975 21.4649 187.975 19.4809C187.975 17.8489 187.591 16.537 186.823 15.545C186.087 14.521 185.015 13.705 183.607 13.097C182.231 12.489 180.599 11.945 178.711 11.465C176.567 10.953 174.935 10.489 173.815 10.073C172.727 9.65695 172.183 8.95295 172.183 7.96095C172.183 6.26495 173.687 5.41695 176.695 5.41695C177.815 5.41695 178.903 5.57695 179.959 5.89695C181.015 6.18495 181.927 6.53695 182.695 6.95295Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M132.182 27.497C130.07 27.497 128.15 27.129 126.422 26.393C124.694 25.625 123.205 24.601 121.957 23.321C120.709 22.009 119.749 20.537 119.077 18.905C118.406 17.273 118.069 15.593 118.069 13.865C118.069 12.105 118.421 10.409 119.125 8.77695C119.829 7.14495 120.822 5.70496 122.102 4.45695C123.382 3.17695 124.885 2.16895 126.613 1.43295C128.341 0.696953 130.229 0.328949 132.277 0.328949C134.389 0.328949 136.31 0.728952 138.038 1.52895C139.766 2.29695 141.238 3.33695 142.454 4.64895C143.702 5.92895 144.661 7.38495 145.333 9.01695C146.005 10.649 146.342 12.3129 146.342 14.0089C146.342 15.7689 145.99 17.465 145.286 19.097C144.582 20.697 143.589 22.137 142.309 23.417C141.061 24.665 139.574 25.657 137.846 26.393C136.118 27.129 134.23 27.497 132.182 27.497ZM123.925 13.913C123.925 15.353 124.262 16.729 124.934 18.041C125.605 19.321 126.549 20.361 127.765 21.161C129.013 21.961 130.501 22.361 132.229 22.361C133.989 22.361 135.477 21.945 136.693 21.113C137.91 20.249 138.837 19.177 139.477 17.8969C140.117 16.5849 140.438 15.241 140.438 13.865C140.438 12.425 140.102 11.0649 139.43 9.78495C138.758 8.50495 137.798 7.48095 136.549 6.71295C135.333 5.91295 133.878 5.51295 132.182 5.51295C130.422 5.51295 128.917 5.92895 127.669 6.76095C126.453 7.59295 125.525 8.64896 124.885 9.92896C124.245 11.209 123.925 12.537 123.925 13.913Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M0 27.305L11.712 0.472954H16.464L28.128 27.305H21.984L19.296 21.017H8.88L6.192 27.305H0ZM14.112 7.52895L10.176 15.977H17.904L14.112 7.52895Z" fill="currentColor"/>
            <path d="M50.8211 0.472954L58.2131 9.97695L65.6051 0.472954H71.8931L61.2851 14.057L71.5571 27.305H65.2691L58.2131 18.185L51.2051 27.305H44.8211L55.1411 14.057L44.4851 0.472954H50.8211Z" fill="currentColor"/>
            </svg>
        </a>
      </div>
      <details class="dropdown-language">
        <summary>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-globe"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            English
          </div>
          <svg id="chevron" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </summary>
        <div class="options">

          <a href="/ptBR/docs/req_config">Português Brasileiro</a>

          <a href="/de/docs/req_config">Deutsch</a>

          <a href="/zh/docs/req_config">中文</a>

          <a href="/uk/docs/req_config">Українська</a>

          <a href="/ku/docs/req_config">کوردی</a>

          <a href="/es/docs/req_config">Español</a>

          <a href="/fr/docs/req_config">Français</a>

          <a href="/hi/docs/req_config">हिंदी</a>

          <a href="/tr/docs/req_config">Türkçe</a>

          <a href="/kr/docs/req_config">한국어</a>

          <a href="/vi/docs/req_config">Tiếng Việt</a>

          <a href="/fa/docs/req_config">فارسی</a>

          <a href="/ru/docs/req_config">Русский</a>

          <a href="/ar/docs/req_config">Arabic</a>

          <a href="/ja/docs/req_config">日本語</a>

          <a href="/zhTW/docs/req_config">繁體中文</a>

          <a href="/it/docs/req_config">Italiano</a>

        </div>
      </details>
      <div class="aside-container">


            <h3 class="group-name">Getting Started</h3>



            <a class="" href="/docs/intro">Introduction</a>



            <a class="" href="/docs/example">Example</a>



            <a class="" href="/docs/post_example">POST Requests</a>



            <h3 class="group-name">Axios API</h3>



            <a class="" href="/docs/api_intro">Axios API</a>



            <a class="" href="/docs/instance">The Axios Instance</a>



            <a class="selected" href="/docs/req_config">Request Config</a>



            <a class="" href="/docs/res_schema">Response Schema</a>



            <a class="" href="/docs/config_defaults">Config Defaults</a>



            <a class="" href="/docs/interceptors">Interceptors</a>



            <a class="" href="/docs/handling_errors">Handling Errors</a>



            <a class="" href="/docs/cancellation">Cancellation</a>



            <a class="" href="/docs/urlencoded">🆕 URL-Encoding Bodies</a>



            <a class="" href="/docs/multipart">🆕 Multipart Bodies</a>



            <h3 class="group-name">Other</h3>



            <a class="" href="https://github.com/axios/axios/blob/v1.x/ECOSYSTEM.md">Ecosystem</a>



            <a class="" href="/docs/notes">Notes</a>



            <h3 class="group-name">Contributors</h3>



            <a class="" href="/docs/sponsor">Sponsoring Axios</a>



            <a class="" href="https://github.com/axios/axios/blob/v1.x/CODE_OF_CONDUCT.md">Code of Conduct</a>



            <a class="" href="https://github.com/axios/axios/blob/v1.x/COLLABORATOR_GUIDE.md">Collaborator Guide</a>



            <a class="" href="https://github.com/axios/axios/blob/v1.x/CONTRIBUTING.md">Contributing to Axios</a>



            <a class="" href="/docs/translating">Translating these docs</a>


      </div>
      <section id="sponsors" aria-label="Axios sponsors">
      </section>
      <div class="button-container">
        <button class="theme">
          <div class="light">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              shape-rendering="geometricPrecision"
              style="color: currentcolor"
            >
              <circle cx="12" cy="12" r="5"></circle>
              <path d="M12 1v2"></path>
              <path d="M12 21v2"></path>
              <path d="M4.22 4.22l1.42 1.42"></path>
              <path d="M18.36 18.36l1.42 1.42"></path>
              <path d="M1 12h2"></path>
              <path d="M21 12h2"></path>
              <path d="M4.22 19.78l1.42-1.42"></path>
              <path d="M18.36 5.64l1.42-1.42"></path>
            </svg>
          </div>
          <div class="slider">
            <span aria-hidden="true" class="roller"></span>
          </div>
          <div class="dark">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              shape-rendering="geometricPrecision"
              style="color: currentcolor"
            >
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
            </svg>
          </div>
        </button>
      </div>
    </aside>
    <main>
      <div class="body">
        <h1 class="title">Request Config</h1>
        <p class="description"></p>
        <p>These are the available config options for making requests. Only the <code>url</code> is required. Requests will default to <code>GET</code> if <code>method</code> is not specified.</p>

<pre class="lang-js"><code><span class="token punctuation">{</span>
  <span class="token comment">// `url` is the server URL that will be used for the request</span>
  url<span class="token operator">:</span> <span class="token string">'/user'</span><span class="token punctuation">,</span>

  <span class="token comment">// `method` is the request method to be used when making the request</span>
  method<span class="token operator">:</span> <span class="token string">'get'</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `baseURL` will be prepended to `url` unless `url` is absolute.</span>
  <span class="token comment">// It can be convenient to set `baseURL` for an instance of axios to pass relative URLs</span>
  <span class="token comment">// to methods of that instance.</span>
  baseURL<span class="token operator">:</span> <span class="token string">'https://some-domain.com/api'</span><span class="token punctuation">,</span>

  <span class="token comment">// `allowAbsoluteUrls` determines whether or not absolute URLs will override a configured `baseUrl`.</span>
  <span class="token comment">// When set to true (default), absolute values for `url` will override `baseUrl`.</span>
  <span class="token comment">// When set to false, absolute values for `url` will always be prepended by `baseUrl`.</span>
  allowAbsoluteUrls<span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span>

  <span class="token comment">// `transformRequest` allows changes to the request data before it is sent to the server</span>
  <span class="token comment">// This is only applicable for request methods 'PUT', 'POST', 'PATCH' and 'DELETE'</span>
  <span class="token comment">// The last function in the array must return a string or an instance of Buffer, ArrayBuffer,</span>
  <span class="token comment">// FormData or Stream</span>
  <span class="token comment">// You may modify the headers object.</span>
  transformRequest<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">data<span class="token punctuation">,</span> headers</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// Do whatever you want to transform the data</span>

    <span class="token keyword control-flow">return</span> data<span class="token punctuation">;</span>
  <span class="token punctuation">}</span><span class="token punctuation">]</span><span class="token punctuation">,</span>

  <span class="token comment">// `transformResponse` allows changes to the response data to be made before</span>
  <span class="token comment">// it is passed to then/catch</span>
  transformResponse<span class="token operator">:</span> <span class="token punctuation">[</span><span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">data</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// Do whatever you want to transform the data</span>

    <span class="token keyword control-flow">return</span> data<span class="token punctuation">;</span>
  <span class="token punctuation">}</span><span class="token punctuation">]</span><span class="token punctuation">,</span>

  <span class="token comment">// `headers` are custom headers to be sent</span>
  headers<span class="token operator">:</span> <span class="token punctuation">{</span><span class="token string">'X-Requested-With'</span><span class="token operator">:</span> <span class="token string">'XMLHttpRequest'</span><span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `params` are the URL parameters to be sent with the request</span>
  <span class="token comment">// Must be a plain object or a URLSearchParams object</span>
  <span class="token comment">// NOTE: params that are null or undefined are not rendered in the URL.</span>
  params<span class="token operator">:</span> <span class="token punctuation">{</span>
    <span class="token constant">ID</span><span class="token operator">:</span> <span class="token number">12345</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `paramsSerializer` is an optional config in charge of serializing `params`</span>
  paramsSerializer<span class="token operator">:</span> <span class="token punctuation">{</span>
    encode<span class="token operator">?</span><span class="token operator">:</span> <span class="token punctuation">(</span>param<span class="token operator">:</span> string<span class="token punctuation">)</span><span class="token operator">:</span> <span class="token parameter">string</span> <span class="token arrow operator">=></span> <span class="token punctuation">{</span> <span class="token comment">/* Do custom ops here and return transformed string */</span> <span class="token punctuation">}</span><span class="token punctuation">,</span> <span class="token comment">// custom encoder function; sends Key/Values in an iterative fashion</span>
    serialize<span class="token operator">?</span><span class="token operator">:</span> <span class="token punctuation">(</span>params<span class="token operator">:</span> <span class="token maybe-class-name">Record</span><span class="token operator">&lt;</span>string<span class="token punctuation">,</span> any<span class="token operator">></span><span class="token punctuation">,</span> options<span class="token operator">?</span><span class="token operator">:</span> <span class="token maybe-class-name">ParamsSerializerOptions</span> <span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token comment">// mimic pre 1.x behavior and send entire params object to a custom serializer func. Allows consumer to control how params are serialized.</span>
    indexes<span class="token operator">:</span> <span class="token boolean">false</span> <span class="token comment">// array indexes format (null - no brackets, false (default) - empty brackets, true - brackets with indexes)</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `data` is the data to be sent as the request body</span>
  <span class="token comment">// Only applicable for request methods 'PUT', 'POST', 'DELETE', and 'PATCH'</span>
  <span class="token comment">// When no `transformRequest` is set, must be of one of the following types:</span>
  <span class="token comment">// - string, plain object, ArrayBuffer, ArrayBufferView, URLSearchParams</span>
  <span class="token comment">// - Browser only: FormData, File, Blob</span>
  <span class="token comment">// - Node only: Stream, Buffer</span>
  data<span class="token operator">:</span> <span class="token punctuation">{</span>
    firstName<span class="token operator">:</span> <span class="token string">'Fred'</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>
  
  <span class="token comment">// syntax alternative to send data into the body</span>
  <span class="token comment">// method post</span>
  <span class="token comment">// only the value is sent, not the key</span>
  data<span class="token operator">:</span> <span class="token string">'Country=Brasil&amp;City=Belo Horizonte'</span><span class="token punctuation">,</span>

  <span class="token comment">// `timeout` specifies the number of milliseconds before the request times out.</span>
  <span class="token comment">// If the request takes longer than `timeout`, the request will be aborted.</span>
  timeout<span class="token operator">:</span> <span class="token number">1000</span><span class="token punctuation">,</span> <span class="token comment">// default is `0` (no timeout)</span>

  <span class="token comment">// `withCredentials` indicates whether or not cross-site Access-Control requests</span>
  <span class="token comment">// should be made using credentials</span>
  withCredentials<span class="token operator">:</span> <span class="token boolean">false</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `adapter` allows custom handling of requests which makes testing easier.</span>
  <span class="token comment">// Return a promise and supply a valid response (see lib/adapters/README.md).</span>
  <span class="token function-variable function">adapter</span><span class="token operator">:</span> <span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">config</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">/* ... */</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `auth` indicates that HTTP Basic auth should be used, and supplies credentials.</span>
  <span class="token comment">// This will set an `Authorization` header, overwriting any existing</span>
  <span class="token comment">// `Authorization` custom headers you have set using `headers`.</span>
  <span class="token comment">// Please note that only HTTP Basic auth is configurable through this parameter.</span>
  <span class="token comment">// For Bearer tokens and such, use `Authorization` custom headers instead.</span>
  
  <span class="token comment">// When using axios instances with pre-configured `auth`, you can override</span>
  <span class="token comment">// or bypass the instance's basic auth configuration in individual requests:</span>
  <span class="token comment">//</span>
  <span class="token comment">// 1. Override with different credentials:</span>
  <span class="token comment">//    instance.get('/path', { auth: { username: 'other', password: 'pass' } })</span>
  <span class="token comment">//</span>
  <span class="token comment">// 2. Bypass basic auth and use a custom Authorization header:</span>
  <span class="token comment">//    instance.get('/path', { auth: null, headers: { Authorization: 'Bearer token' } })</span>
  <span class="token comment">//</span>
  <span class="token comment">// Note: If you don't set `auth: null`, the instance's pre-configured basic auth</span>
  <span class="token comment">// will take precedence over any `Authorization` header you set in the request config.</span>

  auth<span class="token operator">:</span> <span class="token punctuation">{</span>
    username<span class="token operator">:</span> <span class="token string">'janedoe'</span><span class="token punctuation">,</span>
    password<span class="token operator">:</span> <span class="token string">'s00pers3cret'</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `responseType` indicates the type of data that the server will respond with</span>
  <span class="token comment">// options are: 'arraybuffer', 'document', 'json', 'text', 'stream'</span>
  <span class="token comment">//   browser only: 'blob'</span>
  responseType<span class="token operator">:</span> <span class="token string">'json'</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `responseEncoding` indicates encoding to use for decoding responses (Node.js only)</span>
  <span class="token comment">// Note: Ignored for `responseType` of 'stream' or client-side requests</span>
  responseEncoding<span class="token operator">:</span> <span class="token string">'utf8'</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `xsrfCookieName` is the name of the cookie to use as a value for xsrf token</span>
  xsrfCookieName<span class="token operator">:</span> <span class="token string">'XSRF-TOKEN'</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `xsrfHeaderName` is the name of the http header that carries the xsrf token value</span>
  xsrfHeaderName<span class="token operator">:</span> <span class="token string">'X-XSRF-TOKEN'</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `onUploadProgress` allows handling of progress events for uploads</span>
  <span class="token comment">// browser only</span>
  <span class="token function-variable function">onUploadProgress</span><span class="token operator">:</span> <span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">progressEvent</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// Do whatever you want with the native progress event</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `onDownloadProgress` allows handling of progress events for downloads</span>
  <span class="token comment">// browser only</span>
  <span class="token function-variable function">onDownloadProgress</span><span class="token operator">:</span> <span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">progressEvent</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token comment">// Do whatever you want with the native progress event</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `maxContentLength` defines the max size of the http response content in bytes allowed in node.js</span>
  maxContentLength<span class="token operator">:</span> <span class="token number">2000</span><span class="token punctuation">,</span>

  <span class="token comment">// `maxBodyLength` (Node only option) defines the max size of the http request content in bytes allowed</span>
  maxBodyLength<span class="token operator">:</span> <span class="token number">2000</span><span class="token punctuation">,</span>

  <span class="token comment">// `validateStatus` defines whether to resolve or reject the promise for a given</span>
  <span class="token comment">// HTTP response status code. If `validateStatus` returns `true` (or is set to `null`</span>
  <span class="token comment">// or `undefined`), the promise will be resolved; otherwise, the promise will be</span>
  <span class="token comment">// rejected.</span>
  <span class="token function-variable function">validateStatus</span><span class="token operator">:</span> <span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">status</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
    <span class="token keyword control-flow">return</span> status <span class="token operator">>=</span> <span class="token number">200</span> <span class="token operator">&amp;&amp;</span> status <span class="token operator">&lt;</span> <span class="token number">300</span><span class="token punctuation">;</span> <span class="token comment">// default</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `maxRedirects` defines the maximum number of redirects to follow in node.js.</span>
  <span class="token comment">// If set to 0, no redirects will be followed.</span>
  maxRedirects<span class="token operator">:</span> <span class="token number">21</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `beforeRedirect` defines a function that will be called before redirect.</span>
  <span class="token comment">// Use this to adjust the request options upon redirecting,</span>
  <span class="token comment">// to inspect the latest response headers,</span>
  <span class="token comment">// or to cancel the request by throwing an error</span>
  <span class="token comment">// If maxRedirects is set to 0, `beforeRedirect` is not used.</span>
  <span class="token function-variable function">beforeRedirect</span><span class="token operator">:</span> <span class="token punctuation">(</span><span class="token parameter">options<span class="token punctuation">,</span> <span class="token punctuation">{</span> headers <span class="token punctuation">}</span></span><span class="token punctuation">)</span> <span class="token arrow operator">=></span> <span class="token punctuation">{</span>
   <span class="token keyword control-flow">if</span> <span class="token punctuation">(</span>options<span class="token punctuation">.</span><span class="token property-access">hostname</span> <span class="token operator">===</span> <span class="token string">"example.com"</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
     options<span class="token punctuation">.</span><span class="token property-access">auth</span> <span class="token operator">=</span> <span class="token string">"user:password"</span><span class="token punctuation">;</span>
   <span class="token punctuation">}</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `socketPath` defines a UNIX Socket to be used in node.js.</span>
  <span class="token comment">// e.g. '/var/run/docker.sock' to send requests to the docker daemon.</span>
  <span class="token comment">// Only either `socketPath` or `proxy` can be specified.</span>
  <span class="token comment">// If both are specified, `socketPath` is used.</span>
  socketPath<span class="token operator">:</span> <span class="token keyword null nil">null</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `transport` determines the transport method that will be used to make the request. If defined, it will be used. Otherwise, if `maxRedirects` is 0, the default `http` or `https` library will be used, depending on the protocol specified in `protocol`. Otherwise, the `httpFollow` or `httpsFollow` library will be used, again depending on the protocol, which can handle redirects.</span>
  transport<span class="token operator">:</span> <span class="token keyword nil">undefined</span><span class="token punctuation">,</span> <span class="token comment">// default</span>

  <span class="token comment">// `httpAgent` and `httpsAgent` define a custom agent to be used when performing http</span>
  <span class="token comment">// and https requests, respectively, in node.js. This allows options to be added like</span>
  <span class="token comment">// `keepAlive` that are not enabled by default before Node.js v19.0.0. After Node.js</span>
  <span class="token comment">// v19.0.0, you no longer need to customize the agent to enable `keepAlive` because</span>
  <span class="token comment">// `http.globalAgent` has `keepAlive` enabled by default.</span>
  httpAgent<span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">http<span class="token punctuation">.</span>Agent</span><span class="token punctuation">(</span><span class="token punctuation">{</span> keepAlive<span class="token operator">:</span> <span class="token boolean">true</span> <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">,</span>
  httpsAgent<span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">https<span class="token punctuation">.</span>Agent</span><span class="token punctuation">(</span><span class="token punctuation">{</span> keepAlive<span class="token operator">:</span> <span class="token boolean">true</span> <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">,</span>

  <span class="token comment">// `proxy` defines the hostname, port, and protocol of the proxy server.</span>
  <span class="token comment">// You can also define your proxy using the conventional `http_proxy` and</span>
  <span class="token comment">// `https_proxy` environment variables. If you are using environment variables</span>
  <span class="token comment">// for your proxy configuration, you can also define a `no_proxy` environment</span>
  <span class="token comment">// variable as a comma-separated list of domains that should not be proxied.</span>
  <span class="token comment">// Use `false` to disable proxies, ignoring environment variables.</span>
  <span class="token comment">// Disable if supplying a custom httpAgent/httpsAgent to manage proxying requests.</span>
  <span class="token comment">// `auth` indicates that HTTP Basic auth should be used to connect to the proxy, and</span>
  <span class="token comment">// supplies credentials.</span>
  <span class="token comment">// This will set an `Proxy-Authorization` header, overwriting any existing</span>
  <span class="token comment">// `Proxy-Authorization` custom headers you have set using `headers`.</span>
  <span class="token comment">// If the proxy server uses HTTPS, then you must set the protocol to `https`. </span>
  proxy<span class="token operator">:</span> <span class="token punctuation">{</span>
    protocol<span class="token operator">:</span> <span class="token string">'https'</span><span class="token punctuation">,</span>
    host<span class="token operator">:</span> <span class="token string">'127.0.0.1'</span><span class="token punctuation">,</span>
    port<span class="token operator">:</span> <span class="token number">9000</span><span class="token punctuation">,</span>
    auth<span class="token operator">:</span> <span class="token punctuation">{</span>
      username<span class="token operator">:</span> <span class="token string">'mikeymike'</span><span class="token punctuation">,</span>
      password<span class="token operator">:</span> <span class="token string">'rapunz3l'</span>
    <span class="token punctuation">}</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// `signal` and instance of AbortController can be used to cancel the request</span>
  signal<span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">AbortController</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token property-access">signal</span><span class="token punctuation">,</span>

  <span class="token comment">// (Deprecated) `cancelToken` specifies a cancel token that can also be used to cancel the request</span>
  <span class="token comment">// (see Cancellation section below for details)</span>
  cancelToken<span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">CancelToken</span><span class="token punctuation">(</span><span class="token keyword">function</span> <span class="token punctuation">(</span><span class="token parameter">cancel</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
  <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">,</span>

  <span class="token comment">// an alternative way to cancel Axios requests using AbortController</span>
  signal<span class="token operator">:</span> <span class="token keyword">new</span> <span class="token class-name">AbortController</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token property-access">signal</span><span class="token punctuation">,</span>

  <span class="token comment">// `decompress` indicates whether or not the response body should be decompressed </span>
  <span class="token comment">// automatically. If set to `true` will also remove the 'content-encoding' header </span>
  <span class="token comment">// from the responses objects of all decompressed responses</span>
  <span class="token comment">// - Node only (XHR cannot turn off decompression)</span>
  decompress<span class="token operator">:</span> <span class="token boolean">true</span> <span class="token comment">// default</span>

  <span class="token comment">// `insecureHTTPParser` boolean.</span>
  <span class="token comment">// Indicates where to use an insecure HTTP parser that accepts invalid HTTP headers.</span>
  <span class="token comment">// This may allow interoperability with non-conformant HTTP implementations.</span>
  <span class="token comment">// Using the insecure parser should be avoided.</span>
  <span class="token comment">// see options https://nodejs.org/dist/latest-v12.x/docs/api/http.html#http_http_request_url_options_callback</span>
  <span class="token comment">// see also https://nodejs.org/en/blog/vulnerability/february-2020-security-releases/#strict-http-header-parsing-none</span>
  insecureHTTPParser<span class="token operator">:</span> <span class="token keyword nil">undefined</span> <span class="token comment">// default</span>

  <span class="token comment">// transitional options for backward compatibility that may be removed in the newer versions</span>
  transitional<span class="token operator">:</span> <span class="token punctuation">{</span>
    <span class="token comment">// silent JSON parsing mode</span>
    <span class="token comment">// `true`  - ignore JSON parsing errors and set response.data to null if parsing failed (old behaviour)</span>
    <span class="token comment">// `false` - throw SyntaxError if JSON parsing failed (Note: responseType must be set to 'json')</span>
    silentJSONParsing<span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span> <span class="token comment">// default value for the current Axios version</span>

    <span class="token comment">// try to parse the response string as JSON even if `responseType` is not 'json'</span>
    forcedJSONParsing<span class="token operator">:</span> <span class="token boolean">true</span><span class="token punctuation">,</span>

    <span class="token comment">// throw ETIMEDOUT error instead of generic ECONNABORTED on request timeouts</span>
    clarifyTimeoutError<span class="token operator">:</span> <span class="token boolean">false</span><span class="token punctuation">,</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  env<span class="token operator">:</span> <span class="token punctuation">{</span>
    <span class="token comment">// The FormData class to be used to automatically serialize the payload into a FormData object</span>
    <span class="token maybe-class-name">FormData</span><span class="token operator">:</span> <span class="token dom variable">window</span><span class="token operator">?.</span><span class="token maybe-class-name">FormData</span> <span class="token operator">||</span> global<span class="token operator">?.</span><span class="token maybe-class-name">FormData</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  formSerializer<span class="token operator">:</span> <span class="token punctuation">{</span>
    <span class="token function-variable function">visitor</span><span class="token operator">:</span> <span class="token punctuation">(</span><span class="token parameter">value<span class="token punctuation">,</span> key<span class="token punctuation">,</span> path<span class="token punctuation">,</span> helpers</span><span class="token punctuation">)</span> <span class="token arrow operator">=></span> <span class="token punctuation">{</span><span class="token punctuation">}</span><span class="token punctuation">;</span> <span class="token comment">// custom visitor function to serialize form values</span>
    dots<span class="token operator">:</span> boolean<span class="token punctuation">;</span> <span class="token comment">// use dots instead of brackets format</span>
    metaTokens<span class="token operator">:</span> boolean<span class="token punctuation">;</span> <span class="token comment">// keep special endings like {} in parameter key</span>
    indexes<span class="token operator">:</span> boolean<span class="token punctuation">;</span> <span class="token comment">// array indexes format null - no brackets, false - empty brackets, true - brackets with indexes</span>
  <span class="token punctuation">}</span><span class="token punctuation">,</span>

  <span class="token comment">// http adapter only (node.js)</span>
  maxRate<span class="token operator">:</span> <span class="token punctuation">[</span>
    <span class="token number">100</span> <span class="token operator">*</span> <span class="token number">1024</span><span class="token punctuation">,</span> <span class="token comment">// 100KB/s upload limit,</span>
    <span class="token number">100</span> <span class="token operator">*</span> <span class="token number">1024</span>  <span class="token comment">// 100KB/s download limit</span>
  <span class="token punctuation">]</span>
<span class="token punctuation">}</span>
</code></pre>

        <div class="sponsors_container">
          <a class="link-sponsors" href="https://opencollective.com/axios/contribute" target="_blank"><h4>Gold Sponsors</h4></a>
          <span class="btn-container">
            <a class="btn tip" href="https://opencollective.com/axios/contribute" target="_blank" data-tippy-content="&lt;p&gt;Thank you for considering supporting our project.&lt;/p&gt;
               &lt;p&gt;You will be automatically added to this list within 24 hours if the tier you select provides this benefit.&lt;/p&gt;
               &lt;div class=&#34;social&#34;&gt;&lt;a class=&#34;link&#34; href=&#34;/docs/sponsor&#34;&gt;Read more...&lt;/a&gt;&lt;/div&gt;
              ">
              <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
              >
                <path
                        stroke="#000000"
                        stroke-opacity="30%"
                        fill-rule="evenodd"
                        clip-rule="evenodd"
                        d="M12.0122 5.57169L10.9252 4.48469C8.77734 2.33681 5.29493 2.33681 3.14705 4.48469C0.999162 6.63258 0.999162 10.115 3.14705 12.2629L11.9859 21.1017L11.9877 21.0999L12.014 21.1262L20.8528 12.2874C23.0007 10.1395 23.0007 6.65711 20.8528 4.50923C18.705 2.36134 15.2226 2.36134 13.0747 4.50923L12.0122 5.57169ZM11.9877 18.2715L16.9239 13.3352L18.3747 11.9342L18.3762 11.9356L19.4386 10.8732C20.8055 9.50635 20.8055 7.29028 19.4386 5.92344C18.0718 4.55661 15.8557 4.55661 14.4889 5.92344L12.0133 8.39904L12.006 8.3918L12.005 8.39287L9.51101 5.89891C8.14417 4.53207 5.92809 4.53207 4.56126 5.89891C3.19442 7.26574 3.19442 9.48182 4.56126 10.8487L7.10068 13.3881L7.10248 13.3863L11.9877 18.2715Z"
                        fill="white"
                />
              </svg>
              <span>Become a sponsor</span>
            </a>
          </span>
          <section class="splide" aria-label="Axios sponsors" oncontextmenu="return false;">
            <div class="splide__track">
              <ul class="splide__list">









                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="false" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Buzzoid - Buy Instagram Followers (4784$ &lt;sup class=&#34;tier&#34;&gt;Gold&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;At Buzzoid, you can buy Instagram followers quickly, safely, and easily with just a few clicks. Rated world&amp;#39;s #1 IG service since 2012.&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://buzzoid.com/buy-instagram-followers/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://buzzoid.com/buy-instagram-followers/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/opencollective/e1625cb54e10ee40180c99d1495a462e9d6664a4.png"  alt=""/>
                          </div>
                          <span class="caption">Buzzoid - Buy Instagram Followers</span>
                        </a>
                      </li>



                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="false" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Poprey - Buy Instagram Likes (4485$ &lt;sup class=&#34;tier&#34;&gt;Gold&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;Buy Instagram Likes&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://poprey.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://poprey.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/opencollective/e699ec99f7df3a203ddbc49d3c7712a907e628ea.png"  alt=""/>
                          </div>
                          <span class="caption">Poprey - Buy Instagram Likes</span>
                        </a>
                      </li>





                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="false" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Buy Instagram Followers Twicsy (4479$ &lt;sup class=&#34;tier&#34;&gt;Gold&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;Buy real Instagram followers from Twicsy starting at only $2.97. Twicsy has been voted the best site to buy followers from the likes of US Magazine.&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://twicsy.com/buy-instagram-followers?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://twicsy.com/buy-instagram-followers?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/opencollective/dfa9670ad5e66eea17315332453c7f4e3a3b5905.png"  alt=""/>
                          </div>
                          <span class="caption">Buy Instagram Followers Twicsy</span>
                        </a>
                      </li>



                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="true" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Descope (4600$ &lt;sup class=&#34;tier&#34;&gt;200$ a month&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;Hi, we&amp;#39;re Descope! We are building something in the authentication space for app developers and can’t wait to place it in your hands.&lt;/div&gt;&lt;div class=&#34;links&#34;&gt;&lt;a href=&#34;https://www.descope.com/?utm_source=axios&amp;utm_medium=referral&amp;utm_campaign=axios-oss-sponsorship&#34; target=&#34;_blank&#34;&gt;Website&lt;/a&gt;&lt;a href=&#34;https://docs.descope.com/?utm_source=axios&amp;utm_medium=referral&amp;utm_campaign=axios-oss-sponsorship&#34; target=&#34;_blank&#34;&gt;Docs&lt;/a&gt;&lt;a href=&#34;https://www.descope.com/community?utm_source=axios&amp;utm_medium=referral&amp;utm_campaign=axios-oss-sponsorship&#34; target=&#34;_blank&#34;&gt;Community&lt;/a&gt;&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://www.descope.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;a href=&#34;https://github.com/descope?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/github.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;a href=&#34;https://twitter.com/descopeinc?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/twitter.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://www.descope.com/?utm_source=axios&amp;utm_medium=referral&amp;utm_campaign=axios-oss-sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/descope.png" data-dark="/assets/sponsors/descope_white.png"  alt=""/>
                          </div>
                          <span class="caption">Descope</span>
                        </a>
                      </li>





                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="true" data-has-logo="true" data-is-active="yes" data-image-type="svg" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Principal Financial Group (4475$ &lt;sup class=&#34;tier&#34;&gt;175$ a month&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;We’re bound by one common purpose: to give you the financial tools, resources and information you need to live your best life.&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://www.principal.com/about-us?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;a href=&#34;https://github.com/PrincipalFinancialGroup?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/github.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;a href=&#34;https://twitter.com/Principal?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/twitter.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://www.principal.com/about-us?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/principal.svg"  alt=""/>
                          </div>
                          <span class="caption">Principal Financial Group</span>
                        </a>
                      </li>









                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="false" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;span&gt;Requestly (1495$ &lt;sup class=&#34;tier&#34;&gt;Gold&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;A lightweight open-source API Development, Testing &amp;amp; Mocking platform&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://requestly.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://requestly.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/opencollective/16450b4dc0deb9dab5a511bf2bc8b8b4ac33412f.png"  alt=""/>
                          </div>
                          <span class="caption">Requestly</span>
                        </a>
                      </li>







































                      <li class="splide__slide sponsor-card  opacity_100" data-tier="gold" data-is-wide="true" data-has-logo="true" data-is-active="yes" data-image-type="png" data-tippy-content="&lt;h2 class=&#34;caption&#34;&gt;&lt;img class=&#34;sponsor-icon&#34; src=&#34;/assets/sponsors/route4me_icon_55e4b23adce0b1e9f721fc797800e1839c230f79.png&#34; alt=&#34;Route4Me&#34;/&gt;&lt;span&gt;Route4Me (1881$ &lt;sup class=&#34;tier&#34;&gt;99$ a month&lt;/sup&gt;)&lt;/span&gt;&lt;/h2&gt; &lt;div class=&#34;description&#34;&gt;Best Route Planning And Route Optimization Software&lt;/div&gt;&lt;div class=&#34;links&#34;&gt;&lt;a href=&#34;https://route4me.com/platform/route-optimization-software?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;Explore&lt;/a&gt;&lt;a href=&#34;https://route4me.com/platform/marketplace/pricing?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;Free Trial&lt;/a&gt;&lt;a href=&#34;https://route4me.com/contact?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;Contact&lt;/a&gt;&lt;/div&gt;&lt;div class=&#34;social&#34;&gt;&lt;a href=&#34;https://route4me.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/website.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;a href=&#34;https://github.com/route4me?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship&#34; target=&#34;_blank&#34;&gt;&lt;img class=&#34;icon&#34; src=&#34;/assets/icons/social/github.png&#34; alt=&#34;sponsor icon&#34;/&gt;&lt;/a&gt;&lt;/div&gt;">
                        <a href="https://route4me.com/?utm_source=axios&amp;utm_medium=sponsorlist&amp;utm_campaign=sponsorship" target="_blank" >
                          <div>

                           <img src="/assets/sponsors/route4me.png" data-dark="/assets/sponsors/route4me_white.png"  alt="Route Planner and Route Optimizer"/>
                          </div>
                          <span class="caption">Route4Me</span>
                        </a>
                      </li>



















































































































































































































































































































































































































































































































































              </ul>
            </div>
          </section>
        </div>
        <div class="links">

          <a href="/docs/instance" class="next-link">
            <span>« Previous</span>
            <span class="l"> The Axios Instance </span>
          </a>

          <span>

          </span>

              <a href="/docs/res_schema" class="next-link">
                <span>Next »</span>
                <span class="l"> Response Schema </span>
              </a>

        </div>
      </div>
      <div class="col-right"></div>
    </main>

    <script>
      document.querySelector("#hamburger").addEventListener("click", () => {
        document.body.classList.toggle("show-aside");
      });

      document.querySelector("button.theme").addEventListener("click", () => {
        isDarkThemeActive = !isDarkThemeActive;
        localStorage.setItem("@axios-docs:theme", isDarkThemeActive);
        localStorage.setItem("@axios-docs:ts", Date.now());

        document.body.classList.toggle("dark");
        document.querySelector("button.theme").classList.toggle("dark");

        updateImagesTheme(isDarkThemeActive);
      });

      // switch `dir` of those RTL oriented elements that start with an
      // English letter, assuming they are not intended to be RTL aligned.
      if (document.dir === "rtl") {
        document.querySelectorAll("*").forEach(element => {
          if (/[a-zA-Z]/.test(element.textContent.charAt(0))) {
            element.dir = "ltr"
          }
        })
      }

      window.onload = () => {
        if (isDarkThemeActive) {
          document.querySelector("button.theme").classList.toggle("dark");
          updateImagesTheme(true);
        }
        document.documentElement.style.setProperty('--transition-delay', '300ms');
      };

      const sponsorsCount = 7;

      const splide = new Splide('.splide', {
        //type: 'slide',
        type: 'loop',
        drag: 'free',
        focus: 'left',
        perPage: 7,
        snap: true,
        pagination: false,
        autoWidth: true,
        autoScroll: {
          speed: 0.7,
          autoStart: false
        }
      });

      splide.mount(window.splide.Extensions);

      let timer;

      const stop = () => {
        if( timer ) {
          clearTimeout(timer);
          timer = null;
        }
      }

      tippy('.sponsor-card, .tip', {
        trigger: 'mouseenter focus focusin oncontextmenu',
        delay: [500, 500],
        animation: 'fade',
        allowHTML: true,
        hideOnClick: true,
        interactive: true,
        maxWidth: '470px',
        appendTo: () => document.body,
        onShow(instance) {
          if (instance.props.content.trim() === '') {
            return false;
          }

          const tier = instance.reference.getAttribute('data-tier');

          tier && instance.popper.setAttribute('data-tier', tier);

          splide.Components.AutoScroll.pause();
        },

        onHide() {
          stop();

          timer = setTimeout(() => {
            splide.Components.AutoScroll.play();
          }, 5000);
        }
      });

      const $splide = document.querySelector('.splide');

      const onScroll = (e) => {
        const {bottom} = $splide.getBoundingClientRect();

        if (bottom < window.innerHeight) {
          window.removeEventListener('scroll', onScroll);

          setTimeout(() => {
            splide.Components.AutoScroll.play();
          }, 5000);
        }
      }

      window.addEventListener('scroll', onScroll);

      // Set external links to open in new tabs
      document.addEventListener('DOMContentLoaded', function() {
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
          const href = link.getAttribute('href');
          // Check if it's an external link (starts with http/https and not current domain)
          if (href && (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.hostname)) {
            // Add target="_blank" only if not already set
            if (!link.getAttribute('target')) {
              link.setAttribute('target', '_blank');
            }
          }
        });
      });

      // Code block copy functionality
      function initCodeCopyButtons() {
        // Get all pre tags
        const preElements = document.querySelectorAll('main pre');

        preElements.forEach(pre => {
          // Skip if copy button already exists
          if (pre.querySelector('.copy-button')) return;

          // Create copy button
          const copyButton = document.createElement('button');
          copyButton.className = 'copy-button';
          copyButton.textContent = 'Copy';
          copyButton.setAttribute('aria-label', 'Copy code to clipboard');

          // Add copy functionality
          copyButton.addEventListener('click', async () => {
            try {
              // Get text from code element inside pre tag
              const codeElement = pre.querySelector('code');
              let textToCopy = codeElement ? codeElement.textContent : pre.textContent;

              // Remove command line prompts ($ )
              textToCopy = textToCopy.replace(/^\$ /gm, '');

              // Copy to clipboard
              await navigator.clipboard.writeText(textToCopy);

              // Temporarily change button display
              const originalText = copyButton.textContent;
              copyButton.textContent = 'Copied!';
              copyButton.classList.add('copied');

              // Reset after 2 seconds
              setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.classList.remove('copied');
              }, 2000);

            } catch (err) {
              console.error('Failed to copy text: ', err);

              // Fallback for older browsers
              const textArea = document.createElement('textarea');
              const codeElement = pre.querySelector('code');
              let textToCopy = codeElement ? codeElement.textContent : pre.textContent;

              // Remove command line prompts ($ )
              textToCopy = textToCopy.replace(/^\$ /gm, '');

              textArea.value = textToCopy;
              document.body.appendChild(textArea);
              textArea.select();

              try {
                document.execCommand('copy');
                copyButton.textContent = 'Copied!';
                copyButton.classList.add('copied');

                setTimeout(() => {
                  copyButton.textContent = 'Copy';
                  copyButton.classList.remove('copied');
                }, 2000);
              } catch (fallbackErr) {
                console.error('Fallback copy failed: ', fallbackErr);
                copyButton.textContent = 'Failed';
                setTimeout(() => {
                  copyButton.textContent = 'Copy';
                }, 2000);
              }

              document.body.removeChild(textArea);
            }
          });

          // Add copy button to pre tag
          pre.appendChild(copyButton);
        });
      }

      // Initialize copy buttons after DOM is loaded
      document.addEventListener('DOMContentLoaded', initCodeCopyButtons);
    </script>

  </body>
</html>
