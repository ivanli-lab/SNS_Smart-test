/**
 * 更名功能測試
 * @param {import('playwright').Page} page
 * @param {string} timestamp
 */
const path = require('path');

async function checkRenameFunction(page, timestamp) {
  console.log('開始更名功能測試 (點擊帳號名稱 -> 開啟視窗 -> 輸入IDN -> 出現錯誤 -> 輸入英文名+數字 -> 點擊Confirm)...');
  
  try {
    // Step 1: Find Balance element first to locate account name above it
    const accountNameInfo = await page.evaluate(() => {
      // Find Balance element (smallest one)
      const allElements = Array.from(document.querySelectorAll('*'));
      let balanceElement = null;
      let smallestSize = Infinity;
      
      for (const el of allElements) {
        const text = (el.textContent || '').toLowerCase();
        const ownText = (el.innerText || el.textContent || '').toLowerCase();
        const hasBalance = (text.includes('balance') || text.includes('餘額') || text.includes('余额')) &&
                          (ownText.includes('balance') || ownText.includes('餘額') || ownText.includes('余额'));
        
        if (hasBalance && el.offsetParent !== null) {
          const rect = el.getBoundingClientRect();
          const size = rect.width * rect.height;
          if (rect.width > 0 && rect.height > 0 && size < smallestSize && rect.height < 100) {
            balanceElement = el;
            smallestSize = size;
          }
        }
      }
      
      if (!balanceElement) {
        console.log('Balance element not found for account name search');
        return null;
      }
      
      const balanceRect = balanceElement.getBoundingClientRect();
      console.log(`Balance at (${Math.round(balanceRect.x)}, ${Math.round(balanceRect.y)})`);
      
      // Find clickable text above Balance (account name is usually above)
      const candidates = [];
      const allClickables = Array.from(document.querySelectorAll('span, div, a, button, [onclick]'));
      
      for (const el of allClickables) {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').trim();
        
        // Look for elements above balance
        if (rect.bottom <= balanceRect.top && rect.width > 0 && rect.height > 0 && text.length > 0) {
          // Should be reasonably close (within 100px above)
          const distance = balanceRect.top - rect.bottom;
          if (distance < 100 && text.length < 50) { // Account names are usually short
            candidates.push({
              text: text,
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              distance: distance,
              width: rect.width,
              height: rect.height
            });
          }
        }
      }
      
      // Sort by closest to balance
      candidates.sort((a, b) => a.distance - b.distance);
      
      if (candidates.length === 0) {
        console.log('No clickable elements found above balance');
        return null;
      }
      
      console.log(`Found ${candidates.length} potential account name elements above balance`);
      return candidates[0]; // Return the closest one
    });
    
    if (!accountNameInfo) {
      console.log('Account name not found above balance, checking if name input dialog is open...');
      
      // Check if there's a name input dialog open (initial state)
      const nameInputInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[placeholder*="name" i]'));
        for (const input of inputs) {
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && input.offsetParent !== null) {
            return {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              placeholder: input.placeholder || '',
              visible: true
            };
          }
        }
        return null;
      });
      
      if (nameInputInfo) {
        console.log('Found name input field, filling with random name...');
        const randomName = `User_${Math.random().toString(36).slice(2, 8)}`;
        
        // Click and fill the input
        await page.mouse.click(nameInputInfo.x, nameInputInfo.y);
        await page.waitForTimeout(300);
        await page.keyboard.type(randomName, { delay: 50 });
        await page.waitForTimeout(500);
        
        // Look for confirm button
        const confirmButtonInfo = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            const text = (btn.textContent || '').toLowerCase();
            if (rect.width > 0 && rect.height > 0 && 
                (text.includes('confirm') || text.includes('ok') || text.includes('確認') || text.includes('submit'))) {
              return {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
                text: btn.textContent
              };
            }
          }
          return null;
        });
        
        if (confirmButtonInfo) {
          console.log(`Clicking confirm button: ${confirmButtonInfo.text}`);
          await page.mouse.click(confirmButtonInfo.x, confirmButtonInfo.y);
          await page.waitForTimeout(1500);
          
          return {
            hasName: true,
            name: randomName,
            created: true,
            confirmButtonClicked: true,
            confirmClicked: true,
            randomName: randomName,
            newName: randomName,
            idnErrorDetected: false,
            errorShown: false,
            message: `Created new account name: ${randomName}`
          };
        } else {
          console.log('Confirm button not found');
        }
      }
      
      console.log('Could not find account name element or name input');
      return {
        hasName: false,
        name: null,
        clicked: false,
        confirmButtonClicked: false,
        randomName: null,
        idnErrorDetected: false,
        message: 'Account name element not found above balance and no input field available'
      };
    }
    
    console.log(`Found account name: "${accountNameInfo.text}" at (${Math.round(accountNameInfo.x)}, ${Math.round(accountNameInfo.y)})`);
    
    // Step 2: Click the account name to open rename dialog
    console.log('Clicking account name to open rename dialog...');
    await page.mouse.click(accountNameInfo.x, accountNameInfo.y);
    await page.waitForTimeout(1000);
    
    // Step 3: Find input field in the dialog
    console.log('Looking for input field in rename dialog...');
    const inputFieldInfo = await page.evaluate(() => {
      // Look for dialog/modal
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .ant-modal, .dialog, [class*="modal" i], [class*="dialog" i]');
      
      for (const dialog of dialogs) {
        if (dialog.offsetParent === null) continue; // Skip hidden dialogs
        
        // Look for input field
        const inputs = Array.from(dialog.querySelectorAll('input[type="text"], input[type="input"], input:not([type])'));
        
        for (const input of inputs) {
          const rect = input.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && input.offsetParent !== null) {
            return {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              element: input
            };
          }
        }
      }
      
      return null;
    });
    
    if (!inputFieldInfo) {
      console.log('Input field not found in dialog');
      return {
        hasName: true,
        name: accountNameInfo.text,
        clicked: true,
        dialogOpened: true,
        inputFound: false,
        confirmButtonClicked: false,
        randomName: null,
        idnErrorDetected: false,
        message: `Clicked account name "${accountNameInfo.text}" but could not find input field`
      };
    }
    
    console.log(`Found input field at (${Math.round(inputFieldInfo.x)}, ${Math.round(inputFieldInfo.y)})`);
    
    // Step 4: Click input field and type "IDN"
    console.log('Step 1: Typing "IDN" in input field...');
    await page.mouse.click(inputFieldInfo.x, inputFieldInfo.y);
    await page.waitForTimeout(300);
    
    // Clear existing text and type IDN
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(100);
    await page.keyboard.type('IDN', { delay: 50 });
    await page.waitForTimeout(1000);
    
    // Step 5: Wait for error message to appear
    console.log('Step 2: Waiting for error message after typing IDN...');
    await page.waitForTimeout(1500);
    
    const errorMessageInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const errorElements = [];
      
      for (const el of allElements) {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').trim().toLowerCase();
        const className = (el.className || '').toString().toLowerCase();
        const style = window.getComputedStyle(el);
        
        // Look for error messages (usually red text or error class)
        if (rect.width > 0 && rect.height > 0 && el.offsetParent !== null &&
            (text.includes('error') || text.includes('錯誤') || text.includes('invalid') ||
             className.includes('error') || style.color.includes('rgb(255') || 
             style.color.includes('red') || className.includes('warning'))) {
          errorElements.push({
            text: (el.textContent || '').trim(),
            visible: true
          });
        }
      }
      
      return {
        found: errorElements.length > 0,
        messages: errorElements.map(e => e.text)
      };
    });
    
    console.log(`Error message found: ${errorMessageInfo.found ? 'Yes' : 'No'}`);
    if (errorMessageInfo.found) {
      console.log(`Error messages: ${errorMessageInfo.messages.join(', ')}`);
    }
    
    // Step 6: Clear input and type random English name + 4 digits
    console.log('Step 3: Clearing input and typing random English name + 4 digits...');
    await page.mouse.click(inputFieldInfo.x, inputFieldInfo.y);
    await page.waitForTimeout(300);
    
    // Generate random English name (4-8 letters) + 4 digits
    const randomLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomName = Array.from({ length: Math.floor(Math.random() * 5) + 4 }, () => 
      randomLetters[Math.floor(Math.random() * randomLetters.length)]
    ).join('');
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const newName = randomName + randomDigits;
    
    console.log(`Generated new name: ${newName}`);
    
    // Clear and type new name
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(100);
    await page.keyboard.type(newName, { delay: 50 });
    await page.waitForTimeout(1000);
    
    // Step 7: Find and click Confirm button
    console.log('Step 4: Looking for Confirm button...');
    const confirmButtonInfo = await page.evaluate(() => {
      // Look for dialog/modal
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .ant-modal, .dialog, [class*="modal" i], [class*="dialog" i]');
      
      for (const dialog of dialogs) {
        if (dialog.offsetParent === null) continue; // Skip hidden dialogs
        
        // Look for confirm button
        const buttons = Array.from(dialog.querySelectorAll('button, [role="button"], [onclick]'));
        
        for (const btn of buttons) {
          const rect = btn.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          
          const text = (btn.textContent || '').trim().toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const className = (btn.className || '').toString().toLowerCase();
          
          // Check for confirm indicators
          const isConfirmButton = text.includes('confirm') || text.includes('確認') || 
                                 text.includes('ok') || text.includes('submit') ||
                                 ariaLabel.includes('confirm') || ariaLabel.includes('確認') ||
                                 className.includes('confirm') || className.includes('submit');
          
          if (isConfirmButton) {
            return {
              text: btn.textContent || 'Confirm',
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2
            };
          }
        }
      }
      
      return null;
    });
    
    if (!confirmButtonInfo) {
      console.log('Confirm button not found');
      return {
        hasName: true,
        name: accountNameInfo.text,
        clicked: true,
        dialogOpened: true,
        inputFound: true,
        idnEntered: true,
        idnErrorDetected: errorMessageInfo.found,
        newNameEntered: true,
        randomName: newName,
        newName: newName,
        confirmButtonClicked: false,
        confirmClicked: false,
        errorShown: errorMessageInfo.found,
        message: `Entered IDN and new name "${newName}" but could not find Confirm button`
      };
    }
    
    console.log(`Found Confirm button: "${confirmButtonInfo.text}" at (${Math.round(confirmButtonInfo.x)}, ${Math.round(confirmButtonInfo.y)})`);
    
    // Click Confirm button
    await page.mouse.click(confirmButtonInfo.x, confirmButtonInfo.y);
    await page.waitForTimeout(2000);
    
    // Step 8: Verify if rename was successful (check if dialog closed and name changed)
    const renameResult = await page.evaluate(() => {
      // Check if dialog is still open
      const dialogs = document.querySelectorAll('[role="dialog"], .modal, .ant-modal, .dialog, [class*="modal" i], [class*="dialog" i]');
      let dialogStillOpen = false;
      
      for (const dialog of dialogs) {
        if (dialog.offsetParent !== null) {
          dialogStillOpen = true;
          break;
        }
      }
      
      return {
        dialogClosed: !dialogStillOpen
      };
    });
    
    console.log(`Rename successful: ${renameResult.dialogClosed ? 'Yes (dialog closed)' : 'Unknown (dialog may still be open)'}`);
    
    return {
      hasName: true,
      name: accountNameInfo.text,
      clicked: true,
      dialogOpened: true,
      inputFound: true,
      idnEntered: true,
      idnErrorDetected: errorMessageInfo.found,
      errorMessages: errorMessageInfo.messages,
      newNameEntered: true,
      newName: newName,          // 保留舊名稱
      randomName: newName,       // 匹配前端
      confirmClicked: true,      // 保留舊名稱
      confirmButtonClicked: true, // 匹配前端
      renameSuccessful: renameResult.dialogClosed,
      message: `Entered IDN (error shown: ${errorMessageInfo.found}), then entered new name "${newName}" and clicked Confirm. Dialog closed: ${renameResult.dialogClosed}`
    };
    
  } catch (error) {
    console.error('Error in checkAndAssignAccountName:', error);
    return {
      hasName: false,
      clicked: false,
      confirmButtonClicked: false,
      confirmClicked: false,
      randomName: null,
      newName: null,
      idnErrorDetected: false,
      errorShown: false,
      error: String(error && error.message || error),
      message: `Account name check failed: ${error && error.message || error}`
    };
  }
}

module.exports = checkRenameFunction;
