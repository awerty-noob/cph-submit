// Code run when background script detects there is a problem to submit
import config from './config';
import log from './log';

declare const browser: any;

if (typeof browser !== 'undefined') {
    self.chrome = browser;
}

export const isContestProblem = (problemUrl: string) => {
    return problemUrl.indexOf('contest') != -1;
};

export const getSubmitUrl = (problemUrl: string) => {
    if (!isContestProblem(problemUrl)) {
        return config.cfSubmitPage.href;
    }
    // const url = new URL(problemUrl);
    // const contestNumber = url.pathname.split('/')[2];
    // const submitURL = `https://codeforces.com/contest/${contestNumber}/submit`;
    // return submitURL;
    const secondLastSlashIndex = problemUrl.lastIndexOf('/',problemUrl.lastIndexOf('/')-1);
    const submitURL = problemUrl.substring(0,secondLastSlashIndex) + "/submit";
    return submitURL;
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

    const filter = {
        url: [{ urlContains: 'codeforces.com/problemset/status' }],
    };

    log('Adding nav listener');

    chrome.webNavigation.onCommitted.addListener((args) => {
        log('Navigation about to happen');

        if (args.tabId === tab.id) {
            log('Our tab is navigating');

            // const url = new URL(args.url);
            // const searchParams = new URLSearchParams(url.search);

            // if (searchParams.has("friends")) {
            //   return;
            // }

            // log("Navigating to friends mode");

            // chrome.tabs.update(args.tabId, { url: args.url + "?friends=on" });
        }
    }, filter);
};
