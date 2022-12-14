import colorMaster from './ColorMaster.js';

export default class Path {

  svgElement;
  pathElement;
  textElement;
  textPathElement;
  associatedUIElement;
  groupElement;

  // so children won't crash
  firstPathReset = true;

  // identification
  index;

  // for random colors of circles and paths
  svgBackgroundColor;

  // ui interaction
  pointInputs = [];
  fontSizeInput;
  textContentInput;
  textContentFixedInput;
  textXInput;
  textStyleInput;

  // path movement
  initialMousePosition = { x: 0, y: 0 };
  movingPath = false;
  
  // points movement with dragging
  allFocusButtons;
  focusedCircle = null;
  circles = [];
  circleNumbers = [];

  // stores points' positions
  pointBases;
  points = [];

  constructor(master, svg, index, kind) {
    this.master = master;
    this.svgElement = svg;
    this.index = index;
    this.kind = kind;

    this.pointBases = [
      { x: 100, y: 250 }, 
      { x: 245, y: 100 }, 
      { x: 390, y: 250 }, 
    ];

    if(this.kind === 'cubic')
      this.pointBases = [
        { x: 100, y: 250 }, 
        { x: 150, y: 100 }, 
        { x: 340, y: 100 },
        { x: 390, y: 250 },
      ];

    if(this.kind === 'ellipsis')
      this.pointBases = [
        { x: 100, y: 250 },
        { x: 390, y: 250 },
        { x: 100, y: 250 },
      ];

    const svgBackgroundColor = colorMaster.stringToObject(getComputedStyle(this.svgElement).backgroundColor);
    this.color = colorMaster.getContrastingColor(svgBackgroundColor, true);

    this.setUpSVGElements();
    this.resetPath();

    this.master.request('addPathUI', { index: this.index, points: this.points, color: this.color, kind: this.kind });
    this.associatedUIElement = document.querySelector(`[data-path-ui="${index}"]`);
    
    this.pointInputs = this.associatedUIElement.querySelectorAll('[data-point-input]');
    this.fontSizeInput = this.associatedUIElement.querySelector('[data-text-input="size"]');
    this.textContentInput = this.associatedUIElement.querySelector('[data-text-input="textContent"]');
    this.textContentFixedInput = this.associatedUIElement.querySelector('[data-text-input="textContentFixed"]');
    this.textXInput = this.associatedUIElement.querySelector('[data-text-input="x"]');
    this.textStyleInput = this.associatedUIElement.querySelector('[data-text-input="style"]');

    this.allFocusButtons = Array.from(this.associatedUIElement.querySelectorAll('[data-focus-button]'));

    this.#addButtonListeners();
    this.#addCircleListeners();
    this.#addInputListeners();
    this.#addPathMovementListeners();
    this.#addTextListeners();
  }

  setUpSVGElements() {
    this.groupElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.groupElement.classList.add('svg__path-and-text-group');
    this.groupElement.setAttributeNS(null, 'data-path-group', this.index);

    const PathID = `ctg-${Math.random().toFixed(5)}`;
    this.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.pathElement.setAttributeNS(null, 'id', PathID);
    this.pathElement.setAttributeNS(null, 'fill', 'transparent');
    this.pathElement.setAttributeNS(null, 'stroke', this.color, true);

    this.textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.textElement.setAttributeNS(null, 'fill', '#fff');
    this.textElement.setAttributeNS(null, 'data-text-on-path', '');

    this.textPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    this.textPathElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${PathID}`);

    this.svgElement.append(this.groupElement);
    this.groupElement.append(this.pathElement, this.textElement);
    this.textElement.append(this.textPathElement);

    this.textPathElement.textContent = 'My Curved Text :)';
    this.textElement.style = 'font-size: 24px;';
  }

  #addTextListeners() {
    this.fontSizeInput.addEventListener('input', (event) => {
        this.textElement.style.fontSize = event.currentTarget.value + 'px';
    });

    this.textXInput.addEventListener('input', (event) => {
      this.textElement.setAttributeNS(null, 'x', event.currentTarget.value);
    });

    this.textContentInput.addEventListener('input', (event) => {
      this.textElement.children[0].textContent = event.currentTarget.value;
      this.textContentFixedInput.value = event.currentTarget.value;
    });

    this.textContentFixedInput.addEventListener('input', (event) => {
      this.textElement.children[0].textContent = event.currentTarget.value;
      this.textContentInput.value = event.currentTarget.value;
    });

    this.textContentFixedInput.addEventListener('focus', (event) => {
      event.currentTarget.classList.add('path-ui__text-area--fixed-visible');

      // always puts cursor at the end
      const buf = event.currentTarget.value;
      event.currentTarget.value = '';
      event.currentTarget.value = buf;
    });

    this.textContentFixedInput.addEventListener('blur', () => {
      this.textContentFixedInput.classList.remove('path-ui__text-area--fixed-visible');
    });

    // focus text input when text is double clicked
    // maybe just move the input instead of using two (may look weird)
    this.textElement.addEventListener('dblclick', () => {
      this.textContentFixedInput.focus({ preventScroll: true });
    });

    this.textStyleInput.addEventListener('input', (event) => {
      const regexp = /[^;]+:[^;]+/g;
      const userStyle = event.currentTarget.value;

      const properties = userStyle.match(regexp);
      const keyValues = [];

      if(properties)        
        for(let property of properties) {
          let key;
          let value;

          [key, value] = property.split(':');

          key = key.trim().replace('\n', '');
          value = value.trim().replace('\n', '');

          if(!key || !value)
            continue;

          let dashIndex = key.indexOf('-');
          while(dashIndex !== -1) {
            key = 
              key.slice(0, dashIndex) + 
              key.slice(dashIndex + 1, dashIndex + 2).toUpperCase() +
              key.slice(dashIndex + 2);

            dashIndex = key.indexOf('-');
          }

          keyValues.push({ key, value });
        }

      const style = this.textElement.style;

      for(let item of style)
        if(item !== 'font-size')
          style.removeProperty(item);
        else
          style.setProperty(item, '24px');

      for(let i = 0; i < keyValues.length; i++)
        style[keyValues[i].key] = keyValues[i].value;

      this.fontSizeInput.value = parseInt(style.getPropertyValue('font-size'));
    });

    // change x when scrolling over the path
    const onWheel = (event) => {
      event.preventDefault();

      if(event.ctrlKey) {
        const currentSize = parseInt(this.textElement.style.fontSize);
        let amount = event.wheelDeltaY > 0 ? 2 : -2;
        if(currentSize + amount < 1)
          amount = 1;
  
        this.textElement.style.fontSize = currentSize + amount + 'px';
        this.fontSizeInput.value = currentSize + amount;
      } else {
        const currentX = Number(this.textElement.getAttributeNS(null, 'x'));
        const amount = event.wheelDeltaY > 0 ? 5 : -5;
  
        this.textElement.setAttributeNS(null, 'x', currentX + amount);
        this.textXInput.value = currentX + amount;
      }

    }

    this.pathElement.addEventListener('wheel', (event) => onWheel(event), { passive: false });
    // for some reason doesn't always fire when it's only on path
    this.textElement.addEventListener('wheel', (event) => onWheel(event), { passive: false });
  }

  #addButtonListeners() {
    // resetting
    this.associatedUIElement.querySelector('[data-button="reset-path"]')
      .addEventListener('click', () => this.resetPath());

    this.associatedUIElement.querySelector('[data-button="toggle-path-visibility"]')
      .addEventListener('click', (event) => {
        if(
            !this.pathElement.style.display || 
            this.pathElement.style.display === 'inline'
          ) {
          this.pathElement.style.display = 'none';
          this.circles.forEach((circle) => circle.style.display = 'none');
          this.circleNumbers.forEach((number) => number.style.display = 'none');
          event.currentTarget.textContent = 'Show Path';
        } else {
          this.pathElement.style.display = 'inline';
          this.circles.forEach((circle) => circle.style.display = 'inline');
          this.circleNumbers.forEach((number) => number.style.display = 'inline');
          event.currentTarget.textContent = 'Hide Path';
        }
        
      });

    // focusing
    const focusButtonOnClick = (event) => {
      const which = event.currentTarget.getAttribute('data-focus-button');

      for(let val of this.allFocusButtons)
        val.classList.remove('mini-button--active');

      if(this.focusedCircle === this.circles[which]) {
        this.focusedCircle = null;
        return;
      }

      event.currentTarget.classList.add('mini-button--active');
      this.focusedCircle = this.circles[which];

      event.stopPropagation();
    }

    for(let val of this.allFocusButtons)
      val.addEventListener('click', (event) => focusButtonOnClick(event));
  }

  #addCircleListeners() {
    for(let i = 0; i < this.points.length; i++) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.classList.add('svg__bezier-circle');
      circle.setAttributeNS(null, 'data-path-circle', `${i}`);
      circle.setAttributeNS(null, 'cx', this.points[i].x);
      circle.setAttributeNS(null, 'cy', this.points[i].y);
      circle.setAttributeNS(null, 'r', 7);
      circle.setAttributeNS(null, 'fill', this.color);
      circle.setAttributeNS(null, 'fill-opacity', 0.7);

      const number = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      number.classList.add('svg__bezier-circle-number');
      number.setAttributeNS(null, 'x', this.points[i].x - 3);
      number.setAttributeNS(null, 'y', this.points[i].y + 4);
      number.style.fontSize = '10px';
      number.textContent = i;

      this.circles.push(circle);
      this.circleNumbers.push(number);
    }

    this.groupElement.append(...this.circles);
    this.groupElement.append(...this.circleNumbers);

    for(let circle of this.circles) {
      circle.addEventListener('mousedown', (event) => {
        event.stopPropagation();

        this.focusedCircle = event.currentTarget;
      });
    }

    window.addEventListener('mouseup', () => {
      this.focusedCircle = null;
      for(let button of this.allFocusButtons)
        button.classList.remove('mini-button--active');
    });

    window.addEventListener('mousemove', (event) => {
      if(!this.focusedCircle)
        return;

      const svgRect = this.svgElement.getBoundingClientRect();

      const x = Math.round(event.clientX - svgRect.x);
      const y = Math.round(event.clientY - svgRect.y);

      this.focusedCircle.setAttributeNS(null, 'cx', x);
      this.focusedCircle.setAttributeNS(null, 'cy', y);

      const which = parseInt(this.focusedCircle.getAttributeNS(null, 'data-path-circle'));
      this.points[which].x = x;
      this.points[which].y = y;

      this.circleNumbers[which].setAttributeNS(null, 'x', this.points[which].x - 3);
      this.circleNumbers[which].setAttributeNS(null, 'y', this.points[which].y + 4);

      this.updateDAttribute('circle');
    });
  }

  #addInputListeners() {
    const onPathInputUpdate = (event) => {
      const parameter = event.currentTarget.getAttribute('data-point-input');
      
      const indexAndAxis = parameter.split('-');

      this.points[indexAndAxis[0]][indexAndAxis[1]] = Number(event.currentTarget.value);

      this.updateDAttribute('input');
    }

    for(let i = 0; i < this.points.length; i++) {
      const inputX = this.associatedUIElement.querySelector(`[data-point-input="${i}-x"]`);
      const inputY = this.associatedUIElement.querySelector(`[data-point-input="${i}-y"]`);

      inputX.value = this.points[i].x;
      inputY.value = this.points[i].y;

      inputX.addEventListener('input', (event) => onPathInputUpdate(event));
      inputY.addEventListener('input', (event) => onPathInputUpdate(event));
    }
  }

  #addPathMovementListeners() {
    // drag and move
    this.groupElement.addEventListener('mousedown', (event) => {
      this.initialMousePosition.x = event.clientX;
      this.initialMousePosition.y = event.clientY;

      this.movingPath = true;
      this.groupElement.classList.add('svg__path-and-text-group--grabbing');
    });

    window.addEventListener('mouseup', () => {
      this.movingPath = false;
      this.groupElement.classList.remove('svg__path-and-text-group--grabbing');
    });

    window.addEventListener('mousemove', (event) => {
      if(!this.movingPath)
        return;

      const offsetX = Math.round(event.clientX - this.initialMousePosition.x);
      const offsetY = Math.round(event.clientY - this.initialMousePosition.y);
      this.initialMousePosition.x = event.clientX;
      this.initialMousePosition.y = event.clientY;
      this.movePath(offsetX, offsetY);
    });
  }

  updatePointInputs() {
    for(let input of this.pointInputs) {
      const which = input.getAttribute('data-point-input');

      if(which.endsWith('x')) {
        input.value = this.points[parseInt(which)].x;
      } else {
        input.value = this.points[parseInt(which)].y;
      }
    }
  }

  updateCircles() {
    for(let i = 0; i < this.circles.length; i++) {
      this.circles[i].setAttributeNS(null, 'cx', this.points[i].x);
      this.circles[i].setAttributeNS(null, 'cy', this.points[i].y);

      this.circleNumbers[i].setAttributeNS(null, 'x', this.points[i].x - 3);
      this.circleNumbers[i].setAttributeNS(null, 'y', this.points[i].y + 4);
    }
  }

  updateDAttribute(invokedBy) {
    console.error(`'updateDAttribute' method invoked on base Path object. (should be implemented on inheriting classes)`);
  }

  resetPath() {
    for(let i = 0; i < this.pointBases.length; i++) {
      this.points[i] = {};
      this.points[i].x = this.pointBases[i].x;
      this.points[i].y = this.pointBases[i].y;
    }

    // so children won't crash
    if(this.firstPathReset) {
      this.firstPathReset = false;
      return;
    }

    this.updateDAttribute();
  }

  movePath(offsetX, offsetY) {
    for(let i = 0; i < this.points.length; i++) {
      this.points[i].x += offsetX;
      this.points[i].y += offsetY;
    }

    this.updateDAttribute();
  }

  removeFromSVG() {
    this.groupElement.remove();
  }

}