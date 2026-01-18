// ==UserScript==
// @name         DeepSeek Quick Navigation Tool
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Add scroll-to-conversation buttons for DeepSeek chat interface
// @author       Emailtoxjk
// @match        https://chat.deepseek.com/*
// @icon         https://cdn.deepseek.com/chat/icon.png
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const buttonMap = new Map();
    let updateTimeout = null;
    let allContainerDivs = [];

    function initObserver() {
        const observer = new MutationObserver(function(mutations) {
            let hasChanges = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
                    hasChanges = true;
                    break;
                }
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    hasChanges = true;
                    break;
                }
            }
            if (hasChanges) scheduleUpdate();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        return observer;
    }

    function scheduleUpdate() {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateAllButtons, 500);
    }

    function getAllDivs() {
        allContainerDivs = [];
        const allMessageDivs = [];

        const allDivs = document.querySelectorAll('div[class*="ds-message"]');
        allDivs.forEach(div => {
            const className = div.className || '';
            if (!className.includes('ds-message')) return;

            const spaceCount = (className.match(/ /g) || []).length;
            if (spaceCount === 2) allContainerDivs.push(div);
            else if (spaceCount === 1) allMessageDivs.push(div);
        });

        return { allContainerDivs, allMessageDivs };
    }

    function updateAllButtons() {
        const { allContainerDivs, allMessageDivs } = getAllDivs();
        const minLength = Math.min(allContainerDivs.length, allMessageDivs.length);

        allContainerDivs.forEach((container, containerIndex) => {
            if (containerIndex < minLength) {
                addOrUpdateButton(container, allMessageDivs[containerIndex], containerIndex, containerIndex);
            } else {
                removeButton(container);
            }
        });

        // 检查目标消息div是否还存在
        for (const [container, buttonData] of buttonMap.entries()) {
            if (!document.body.contains(container)) {
                buttonMap.delete(container);
            }
        }
    }

    function addOrUpdateButton(container, targetMessage, containerIndex, messageIndex) {
        let buttonData = buttonMap.get(container);

        if (!buttonData) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'ds-scroll-btn-container';
            buttonContainer.style.cssText = 'position: absolute; top: -35px; left: 50%; transform: translateX(-50%); z-index: 1000; opacity: 0.9; transition: opacity 0.2s; display: flex; align-items: center; gap: 8px;';

            const prevButton = createNavButton('◀');
            prevButton.addEventListener('click', function(e) {
                e.stopPropagation();
                navigateToContainerButton(containerIndex, 'prev');
            });

            const mainButton = document.createElement('button');
            mainButton.textContent = `Chat ${messageIndex + 1}`;
            mainButton.style.cssText = 'padding: 4px 12px; background: linear-gradient(135deg, #10a37f, #0d8c6d); color: white; border: none; border-radius: 16px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3); white-space: nowrap; backdrop-filter: blur(4px); min-width: 60px;';

            mainButton.addEventListener('mouseenter', function() {
                this.style.background = 'linear-gradient(135deg, #0d8c6d, #0b755a)';
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 12px rgba(16, 163, 127, 0.4)';
                this.style.opacity = '1';
            });

            mainButton.addEventListener('mouseleave', function() {
                this.style.background = 'linear-gradient(135deg, #10a37f, #0d8c6d)';
                this.style.transform = 'translateY(0)';
                this.style.boxShadow = '0 2px 8px rgba(16, 163, 127, 0.3)';

            });

            mainButton.addEventListener('click', function(e) {
                e.stopPropagation();
                if (targetMessage) {
                    const messageRect = targetMessage.getBoundingClientRect();
                    const isInViewport = messageRect.top >= 0 && messageRect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

                    if (!isInViewport) {
                        targetMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }

                    highlightMessage(targetMessage);
                }
            });

            const nextButton = createNavButton('▶');
            nextButton.addEventListener('click', function(e) {
                e.stopPropagation();
                navigateToContainerButton(containerIndex, 'next');
            });

            buttonContainer.appendChild(prevButton);
            buttonContainer.appendChild(mainButton);
            buttonContainer.appendChild(nextButton);

            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            container.prepend(buttonContainer);

            // 输入底部添加▲按钮
            const containerTopButtonContainer = document.createElement('div');
            containerTopButtonContainer.className = 'ds-container-top-btn-container';
            containerTopButtonContainer.style.cssText = 'position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); z-index: 1000;';

            const containerTopButton = createNavButton('▲');

            containerTopButton.addEventListener('click', function(e) {
                e.stopPropagation();
                container.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            containerTopButtonContainer.appendChild(containerTopButton);
            container.appendChild(containerTopButtonContainer);

            // 底部添加▲按钮
            const topButtonContainer = document.createElement('div');
            topButtonContainer.className = 'ds-top-btn-container';
            topButtonContainer.style.cssText = 'position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); z-index: 1000;';

            const topButton = createNavButton('▲');

            topButton.addEventListener('click', function(e) {
                e.stopPropagation();
                if (targetMessage) {
                    targetMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    highlightMessage(targetMessage);
                }
            });

            topButtonContainer.appendChild(topButton);
            if (getComputedStyle(targetMessage).position === 'static') targetMessage.style.position = 'relative';
            targetMessage.appendChild(topButtonContainer);

            // 修改
            buttonMap.set(container, {
                nav: buttonContainer,
                top: topButtonContainer,
                containerTop: containerTopButtonContainer,
                targetMessage: targetMessage,
            });
        } else {
            const mainButton = buttonData.nav.querySelector('button:nth-child(2)');
            if (mainButton) mainButton.textContent = `Chat ${messageIndex + 1}`;
        }
    }

    function createNavButton(text) {
        const button = document.createElement('button');
        button.textContent = text;

        // ▲按钮字体稍大一点
        const isTopButton = text === '▲';
        const buttonSize = '24px';
		const buttonOpacity = 0.5;
        const fontSize = isTopButton ? '12px' : '10px';

        button.style.cssText = `
            padding: 4px 8px;
            background: linear-gradient(135deg, #10a37f, #0d8c6d);
            color: white;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            font-size: ${fontSize};
            font-weight: bold;
            transition: all 0.2s ease;
            box-shadow: 0 2px 6px rgba(16, 163, 127, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${buttonSize};
            height: ${buttonSize};
            backdrop-filter: blur(4px);
            opacity: ${buttonOpacity};
        `;

        button.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, #0d8c6d, #0b755a)';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 12px rgba(16, 163, 127, 0.4)';
            this.style.opacity = '1';
        });

        button.addEventListener('mouseleave', function() {
            this.style.background = 'linear-gradient(135deg, #10a37f, #0d8c6d)';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 6px rgba(16, 163, 127, 0.3)';
			// 恢复透明度
            this.style.opacity = buttonOpacity;
        });

        return button;
    }

    function navigateToContainerButton(currentIndex, direction) {
        const { allContainerDivs } = getAllDivs();
        const totalContainers = allContainerDivs.length;
        if (totalContainers === 0) return;

        let targetIndex;
        if (direction === 'prev') {
            targetIndex = (currentIndex - 1 + totalContainers) % totalContainers;
        } else {
            targetIndex = (currentIndex + 1) % totalContainers;
        }

        if (targetIndex >= 0 && targetIndex < totalContainers) {
            const targetContainer = allContainerDivs[targetIndex];
            const buttonData = buttonMap.get(targetContainer);

            if (buttonData) {
                const nextButton = buttonData.nav.querySelector('button:last-child');
                if (nextButton) {
                    nextButton.focus();
                    const containerRect = targetContainer.getBoundingClientRect();
                    const isInViewport = containerRect.top >= 0 && containerRect.bottom <= (window.innerHeight || document.documentElement.clientHeight);

                    if (!isInViewport) {
                        targetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            }
        }
    }

    // 同时移除两类按钮
    function removeButton(container) {
        const buttonData = buttonMap.get(container);
        if (buttonData) {
            if (buttonData.nav && buttonData.nav.parentNode) {
                buttonData.nav.parentNode.removeChild(buttonData.nav);
            }
            if (buttonData.top && buttonData.top.parentNode) {
                buttonData.top.parentNode.removeChild(buttonData.top);
            }
            buttonMap.delete(container);
        }
    }

    function highlightMessage(messageDiv) {
        const originalBoxShadow = messageDiv.style.boxShadow;
        const originalBorderRadius = messageDiv.style.borderRadius;
        const originalTransition = messageDiv.style.transition;

        messageDiv.style.transition = 'all 0.3s ease';
        messageDiv.style.boxShadow = '0 0 0 3px rgba(16, 163, 127, 0.4)';
        messageDiv.style.borderRadius = '8px';

        setTimeout(() => {
            messageDiv.style.boxShadow = originalBoxShadow;
            messageDiv.style.borderRadius = originalBorderRadius;
            messageDiv.style.transition = originalTransition;
        }, 1500);
    }

    function init() {
        const style = document.createElement('style');
        style.textContent = `
            .ds-scroll-btn:active { transform: scale(0.95) !important; }
            @keyframes dsButtonAppear { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 0.9; transform: translateX(-50%) translateY(0); } }
            .ds-scroll-btn-container { animation: dsButtonAppear 0.3s ease-out; }
            @keyframes dsButtonPulse { 0% { box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3); } 50% { box-shadow: 0 2px 16px rgba(16, 163, 127, 0.5); } 100% { box-shadow: 0 2px 8px rgba(16, 163, 127, 0.3); } }
            .ds-scroll-btn:hover { animation: dsButtonPulse 1.5s infinite; }
        `;
        document.head.appendChild(style);

        initObserver();
        setTimeout(updateAllButtons, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();