(function () {
    'use strict';

    const STORAGE_KEY = 'happy-llm-companion-enabled';
    const chapterPattern = /(?:^|\/)chapter([1-8])(?:\/|$)/;
    let renderToken = 0;

    function normalizeText(value) {
        return (value || '').replace(/\s+/g, ' ').trim();
    }

    function getChapterNumber() {
        let route = window.location.hash.replace(/^#\/?/, '/').split('?')[0];

        try {
            route = decodeURIComponent(route);
        } catch (error) {
            // A malformed route should simply render without companion notes.
        }

        const match = route.match(chapterPattern);
        return match ? match[1] : null;
    }

    function isEnabled() {
        return localStorage.getItem(STORAGE_KEY) !== 'false';
    }

    function setEnabled(enabled) {
        localStorage.setItem(STORAGE_KEY, String(enabled));
        document.body.classList.toggle('companion-hidden', !enabled);

        document.querySelectorAll('.companion-toggle-input').forEach(function (input) {
            input.checked = enabled;
        });

        document.querySelectorAll('.companion-toggle-state').forEach(function (label) {
            label.textContent = enabled ? '已开启' : '已隐藏';
        });
    }

    function findHeading(article, headingText) {
        const wanted = normalizeText(headingText);
        return Array.from(article.querySelectorAll('h1, h2, h3, h4')).find(function (heading) {
            return normalizeText(heading.textContent) === wanted;
        });
    }

    function findTextAnchor(article, text) {
        if (!text) return null;

        const wanted = normalizeText(text);
        const candidates = article.querySelectorAll('p, blockquote, pre, li, table, .katex-display');

        return Array.from(candidates).find(function (element) {
            return normalizeText(element.textContent).includes(wanted);
        });
    }

    function createParagraph(text) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
    }

    function createLabeledSection(className, labelText, content, contentClassName) {
        const section = document.createElement('div');
        section.className = className;

        const label = document.createElement('strong');
        label.textContent = labelText;
        section.appendChild(label);

        const lines = Array.isArray(content) ? content : [content];
        lines.forEach(function (line) {
            const paragraph = createParagraph(line);
            if (contentClassName) paragraph.className = contentClassName;
            section.appendChild(paragraph);
        });

        return section;
    }

    function createCard(note, chapterNumber) {
        const card = document.createElement('details');
        card.className = 'companion-card';
        card.dataset.companionId = note.id;
        card.open = true;

        const summary = document.createElement('summary');
        summary.className = 'companion-card-summary';

        const icon = document.createElement('span');
        icon.className = 'companion-card-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🐣';

        const heading = document.createElement('span');
        heading.className = 'companion-card-heading';

        const eyebrow = document.createElement('span');
        eyebrow.className = 'companion-card-eyebrow';
        eyebrow.textContent = '伴读 · 第 ' + chapterNumber + ' 章';

        const title = document.createElement('span');
        title.className = 'companion-card-title';
        title.textContent = note.title;

        const chevron = document.createElement('span');
        chevron.className = 'companion-card-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '⌄';

        heading.appendChild(eyebrow);
        heading.appendChild(title);
        summary.appendChild(icon);
        summary.appendChild(heading);
        summary.appendChild(chevron);
        card.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'companion-card-body';

        if (note.lead) {
            const lead = createParagraph(note.lead);
            lead.className = 'companion-card-lead';
            body.appendChild(lead);
        }

        if (note.explain) {
            const explanation = document.createElement('div');
            explanation.className = 'companion-explanation';

            const label = document.createElement('strong');
            label.textContent = note.explainLabel || '换个说法';
            explanation.appendChild(label);

            const lines = Array.isArray(note.explain) ? note.explain : [note.explain];
            lines.forEach(function (line) {
                explanation.appendChild(createParagraph(line));
            });
            body.appendChild(explanation);
        }

        if (note.howItWorks) {
            body.appendChild(createLabeledSection(
                'companion-how-it-works',
                '它大概怎么运作',
                note.howItWorks
            ));
        }

        if (note.math) {
            body.appendChild(createLabeledSection(
                'companion-math',
                '数学上先记住',
                note.math,
                'companion-math-line'
            ));
        }

        if (note.points && note.points.length) {
            const list = document.createElement('ul');
            list.className = 'companion-points';
            note.points.forEach(function (point) {
                const item = document.createElement('li');
                item.textContent = point;
                list.appendChild(item);
            });
            body.appendChild(list);
        }

        if (note.remember) {
            const remember = document.createElement('div');
            remember.className = 'companion-remember';

            const label = document.createElement('strong');
            label.textContent = '先记住';

            const text = document.createElement('span');
            text.textContent = note.remember;

            remember.appendChild(label);
            remember.appendChild(text);
            body.appendChild(remember);
        }

        card.appendChild(body);
        return card;
    }

    function createToolbar(noteCount) {
        const toolbar = document.createElement('div');
        toolbar.className = 'companion-toolbar';
        toolbar.setAttribute('role', 'region');
        toolbar.setAttribute('aria-label', '伴读模式控制');

        const intro = document.createElement('div');
        intro.className = 'companion-toolbar-copy';

        const title = document.createElement('strong');
        title.textContent = '零基础伴读模式';

        const count = document.createElement('span');
        count.textContent = '本页 ' + noteCount + ' 条伴读，不改动教材原文';

        intro.appendChild(title);
        intro.appendChild(count);

        const control = document.createElement('label');
        control.className = 'companion-toggle';

        const state = document.createElement('span');
        state.className = 'companion-toggle-state';

        const input = document.createElement('input');
        input.className = 'companion-toggle-input';
        input.type = 'checkbox';
        input.setAttribute('aria-label', '显示或隐藏伴读内容');
        input.checked = isEnabled();
        input.addEventListener('change', function () {
            setEnabled(input.checked);
        });

        const track = document.createElement('span');
        track.className = 'companion-toggle-track';
        track.setAttribute('aria-hidden', 'true');

        control.appendChild(state);
        control.appendChild(input);
        control.appendChild(track);
        toolbar.appendChild(intro);
        toolbar.appendChild(control);

        return toolbar;
    }

    function insertNote(article, note, chapterNumber) {
        const heading = findHeading(article, note.afterHeading);
        let anchor = findTextAnchor(article, note.afterText);

        if (anchor && heading && heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_PRECEDING) {
            anchor = null;
        }

        anchor = anchor || heading;
        if (!anchor) return false;

        anchor.insertAdjacentElement('afterend', createCard(note, chapterNumber));
        return true;
    }

    async function renderCompanion() {
        const token = ++renderToken;
        const chapterNumber = getChapterNumber();
        const article = document.querySelector('.markdown-section');

        document.querySelectorAll('.companion-toolbar, .companion-card').forEach(function (element) {
            element.remove();
        });

        if (!chapterNumber || !article) return;

        try {
            const response = await fetch('./companion/chapter' + chapterNumber + '.json');
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const notes = await response.json();
            if (token !== renderToken || getChapterNumber() !== chapterNumber) return;

            let inserted = 0;
            // Insert from the end so notes sharing one paragraph keep JSON order.
            notes.slice().reverse().forEach(function (note) {
                if (insertNote(article, note, chapterNumber)) inserted += 1;
            });

            if (inserted > 0) {
                article.insertBefore(createToolbar(inserted), article.firstChild);
                setEnabled(isEnabled());
            }
        } catch (error) {
            console.warn('[Happy-LLM companion] Unable to load chapter notes:', error);
        }
    }

    window.HappyLLMCompanionPlugin = function (hook) {
        hook.doneEach(renderCompanion);
    };
})();
