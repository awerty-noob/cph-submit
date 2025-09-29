// Code run when background script detects there is a problem to submit
import log from './log';

declare const browser: any;

if (typeof browser !== 'undefined') {
    self.chrome = browser;
}

export const isContestProblem = (problemUrl: string) => {
    try {
        const url = new URL(problemUrl);
        const segments = url.pathname.split('/').filter(Boolean);
        const problemIndex = segments.indexOf('problem');

        if (problemIndex === -1) {
            return false;
        }

        const scope = segments[0];

        return scope === 'contest' || scope === 'gym' || scope === 'group';
    } catch (e) {
        return false;
    }
};

export const getSubmitUrl = (problemUrl: string) => {
    try {
        const url = new URL(problemUrl);
        const segments = url.pathname.split('/').filter(Boolean);
        const problemIndex = segments.indexOf('problem');

        if (problemIndex === -1) {
            return problemUrl;
        }

        if (segments[0] === 'problemset') {
            const contestId = segments[2];

            if (contestId) {
                url.pathname = `/contest/${contestId}/submit`;
                url.search = '';
                url.hash = '';
                return url.toString();
            }

            return problemUrl;
        }

        const baseSegments = segments.slice(0, problemIndex);

        if (baseSegments.length === 0) {
            return problemUrl;
        }

        url.pathname = `/${baseSegments.join('/')}/submit`;
        url.search = '';
        url.hash = '';

        return url.toString();
    } catch (e) {
        return problemUrl;
    }
};

/** Opens the codefoces submit page and injects script to submit code. */
export const handleSubmit = async (
    problemName: string,
    languageId: number,
    sourceCode: string,
    problemUrl: string,
) => {
    if (problemName === '' || languageId == -1 || sourceCode == '') {
        log('Invalid arguments to handleSubmit');
        return;
    }

    log('isContestProblem', isContestProblem(problemUrl));

    const submitUrl = getSubmitUrl(problemUrl);
    const tabs = await chrome.tabs.query({ url: 'https://codeforces.com/*' });

    let tab;
    let navigationExpected = false;

    if (tabs.length > 0 && tabs[0].id) {
        if (tabs[0].url !== submitUrl) {
            navigationExpected = true;
        }
        try {
            tab = await chrome.tabs.update(tabs[0].id, {
                active: true,
                url: submitUrl,
            });
        } catch (e) {
            log('Failed to update tab, maybe it was closed. Creating a new one.', e);
        }
    }

    if (!tab) {
        navigationExpected = true;
        tab = await chrome.tabs.create({
            active: true,
            url: submitUrl,
        });
    }

    const tabId = tab.id as number;

    chrome.windows.update(tab.windowId, {
        focused: true,
    });

    const executePayload = async () => {
        if (typeof browser !== 'undefined') {
            await browser.tabs.executeScript(tabId, {
                file: '/dist/injectedScript.js',
            });
        } else {
            await chrome.scripting.executeScript({
                target: {
                    tabId,
                    allFrames: true,
                },
                files: ['/dist/injectedScript.js'],
            });
        }
        chrome.tabs.sendMessage(tabId, {
            type: 'cph-submit',
            problemName,
            languageId,
            sourceCode,
            url: problemUrl,
        });
        log('Sending message to tab with script');
    };

    if (navigationExpected) {
        const listener = (id: number, info: any) => {
            if (id === tabId && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                executePayload();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    } else {
        executePayload();
    }

};
