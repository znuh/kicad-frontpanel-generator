/* only invoked during initial loading */
(() => {
	'use strict';

	function apply_theme() {
		const sys_theme = (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
		const ls_theme  = localStorage.getItem('theme');
		const theme     = (!ls_theme || ls_theme === 'auto') ? sys_theme : ls_theme;
		document.documentElement.setAttribute('data-bs-theme', theme);
	}

	apply_theme();

	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply_theme);
})();
