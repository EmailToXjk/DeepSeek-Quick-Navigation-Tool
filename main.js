// ==UserScript==
// @name         DeepSeek Quick Navigation Tool
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Add move to top button. Optimize page update strategy
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

    // 优化更新策略
    function scheduleUpdate() {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            // 检查是否有新增或删除的聊天
            const { allContainerDivs: newContainerDivs, allMessageDivs: newMessageDivs } = getAllDivs();

            // 如果数量没变，检查buttonMap中是否有缺失的按钮
            let needsUpdate = newContainerDivs.length !== allContainerDivs.length;

            if (!needsUpdate) {
                // 检查是否所有容器都有对应的按钮
                for (const container of newContainerDivs) {
                    if (!buttonMap.has(container)) {
                        needsUpdate = true;
                        break;
                    }
                }
            }

            if (needsUpdate) {
                allContainerDivs = newContainerDivs;
                updateAllButtons();
            }
        }, 1000);
    }

    function getAllDivs() {
        const currentContainerDivs = [];
        const currentMessageDivs = [];

        const allDivs = document.querySelectorAll('div[class*="ds-message"]');
        allDivs.forEach(div => {
            const className = div.className || '';
            if (!className.includes('ds-message')) return;

            const spaceCount = (className.match(/ /g) || []).length;
            if (spaceCount === 2) currentContainerDivs.push(div);
            else if (spaceCount === 1) currentMessageDivs.push(div);
        });

        return {
            allContainerDivs: currentContainerDivs,
            allMessageDivs: currentMessageDivs
        };
    }

    function updateAllButtons() {
        const { allContainerDivs: newContainerDivs, allMessageDivs: newMessageDivs } = getAllDivs();

        // 更新全局变量
        allContainerDivs = newContainerDivs;

        const minLength = Math.min(newContainerDivs.length, newMessageDivs.length);

        // 处理现有的按钮
        const processedContainers = new Set();

        // 更新或添加按钮
        newContainerDivs.forEach((container, containerIndex) => {
            if (containerIndex < minLength) {
                addOrUpdateButton(container, newMessageDivs[containerIndex], containerIndex, containerIndex);
                processedContainers.add(container);
            }
        });

        // 清理不再存在的按钮
        for (const [container, buttonData] of buttonMap.entries()) {
            if (!processedContainers.has(container)) {
                removeButton(container);
            }
        }

        // 清理已删除容器的映射
        for (const [container] of buttonMap.entries()) {
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

    function removeButton(container) {
        const buttonData = buttonMap.get(container);
        if (buttonData) {
            if (buttonData.nav && buttonData.nav.parentNode) {
                buttonData.nav.parentNode.removeChild(buttonData.nav);
            }
            if (buttonData.top && buttonData.top.parentNode) {
                buttonData.top.parentNode.removeChild(buttonData.top);
            }
            if (buttonData.containerTop && buttonData.containerTop.parentNode) {
                buttonData.containerTop.parentNode.removeChild(buttonData.containerTop);
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
    function addFloatingScrollTopButton() {
        // 查找包含aaff8b8f类名的div
        const targetDiv = document.querySelector('div[class*="aaff8b8f"]');
        if (!targetDiv) return;

        // 检查是否已经添加了滚动到顶部按钮
        const existingScrollTopButton = targetDiv.querySelector('.ds-atom-button_top');
        if (existingScrollTopButton) return;

        // 创建新的滚动到顶部按钮
        const scrollTopButton = document.createElement('button');
        scrollTopButton.setAttribute('role', 'button');
        scrollTopButton.setAttribute('aria-disabled', 'false');
        scrollTopButton.className = 'ds-atom-button_top _0e98de6 ds-floating-button ds-floating-button--icon ds-floating-button--lg';

        scrollTopButton.style.cssText = 'padding: 9px; font-size: 14px; line-height: 0px; bottom: 132%;';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'ds-icon ds-atom-button_top__icon';
        iconDiv.style.cssText = 'font-size: 14px; width: 14px; height: 14px; margin-right: 0px;';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 14 14');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // 垂直翻转
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 2.1514 8.5 L 2.5762 8.0762 L 5.3027 5.3486 C 5.5584 5.0929 5.7844 4.8662 5.9883 4.7021 C 6.2009 4.5312 6.444 4.3824 6.75 4.334 C 6.9157 4.3078 7.0843 4.3078 7.25 4.334 C 7.556 4.3824 7.7991 4.5312 8.0117 4.7021 C 8.2156 4.8662 8.4416 5.0929 8.6973 5.3486 L 11.4238 8.0762 L 11.8486 8.5 L 11 9.3486 L 10.5762 8.9238 L 7.8486 6.1973 C 7.574 5.9227 7.4012 5.7515 7.2598 5.6377 C 7.1271 5.531 7.0773 5.5219 7.0625 5.5195 C 7.021 5.513 6.979 5.513 6.9375 5.5195 C 6.9227 5.5219 6.8729 5.531 6.7402 5.6377 C 6.5988 5.7515 6.426 5.9227 6.1514 6.1973 L 3.4238 8.9238 L 3 9.3486 L 2.1514 8.5 Z');
        path.setAttribute('fill', 'currentColor');

        svg.appendChild(path);
        iconDiv.appendChild(svg);

        // 空的span
        const span = document.createElement('span');

        scrollTopButton.appendChild(iconDiv);
        scrollTopButton.appendChild(span);

        // 点击滚动到顶部（实际滚动到第一个聊天）
        scrollTopButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const { allContainerDivs, allMessageDivs } = getAllDivs();

            if (allContainerDivs.length > 0) {
                allContainerDivs[0].scrollIntoView({
                    //behavior: 'smooth',
                    block: 'start'
                });
            }
        });

        // 添加到目标div中
        targetDiv.appendChild(scrollTopButton);
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
        setTimeout(addFloatingScrollTopButton, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();