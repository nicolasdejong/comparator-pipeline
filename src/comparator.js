'use strict'
let naturalSort = require('natural-sort')();

/**
 * Comparators.
 * Pipeline comparator. Pipeline is performed left to right.
 * For example array.sort(Comparator.natural.reversed);
 *
 * See readme.md for documentation.
 **/
const Comparator = createComparatorProxy([]);
module.exports = Comparator;

const actions = {}; // name -> { func, name, type }
const COMPARATOR   = 'comparators';
const KEYMAPPER    = 'keyMappers';
const VALUEMAPPER  = 'valueMappers';
const RESULTMAPPER = 'resultMappers';
const functionsPerType = {
  [COMPARATOR]:   createTargetProxy(COMPARATOR),
  [KEYMAPPER]:    createTargetProxy(KEYMAPPER),
  [VALUEMAPPER]:  createTargetProxy(VALUEMAPPER),
  [RESULTMAPPER]: createTargetProxy(RESULTMAPPER)
};
const defaultSort = (a, b) => (a < b ? -1 : (a > b ? 1 : 0));

Comparator['default'] = defaultSort;
Comparator.natural    = naturalSort;
Comparator.literal    = defaultSort;
Comparator.configurable.setup = function(...items) {
  // this = { pipeline, actions, createComparatorProxy }
  let pipeline = this.pipeline;
  items = flatten(items);
  while (items.length) {
    let prop = items.shift();
    let action = this.actions[prop];
    if (!action) throw new Error('Unknown action requested: ' + prop);
    if (action.configurable) action = {
      type: action.type,
      name: action.name,
      func: action.func.call(undefined, items.shift())
    };
    pipeline.push(action);
  }
  return createComparatorProxy(pipeline);
};

Comparator.valueMappers.any        = v => v;
Comparator.valueMappers.text       = v => String(v);
Comparator.valueMappers.string     = Comparator.valueMappers.text;
Comparator.valueMappers.strings    = Comparator.valueMappers.string;
Comparator.valueMappers.numbers    = v => parseFloat(v);
Comparator.valueMappers.number     = Comparator.valueMappers.numbers;
Comparator.valueMappers.configurable.map = mapper => (val, obj) => mapper(val, obj);
Comparator.valueMappers.ignoreCase = v => String(v).toLowerCase();
Comparator.valueMappers.trim       = v => String(v).trim();

Comparator.keyMappers.configurable.key = (...names) => resultIn => {
  let result = resultIn;
  names.forEach( name => result = result ? result[name] : result );
  return result;
};

Comparator.resultMappers.reversed = result => -result;
Comparator.resultMappers.reverse  = Comparator.resultMappers.reversed;


function pipelineRunner(pipeline, a, b) {
  let initialA = a;
  let initialB = b;
  let result = undefined;
  let finished = false;
  let getResult = () => result = actions['default'].func(a, b);
  let hasResult = () => result !== undefined && result !== 0;
  let mappedKey = false;
  pipeline.forEach(step => {
    if (finished) return;

    if (!hasResult()) {
      switch (step.type) {
        case COMPARATOR:   result = step.func(a, b);
                           break;
        case VALUEMAPPER:  a = step.func(a, initialA);
                           b = step.func(b, initialB);
                           break;
        case RESULTMAPPER: getResult();
                           if (hasResult()) {
                             result = step.func(result);
                           }
                           break;
        case KEYMAPPER:    if (mappedKey && hasResult(getResult())) {
                             finished = true;
                           } else {
                             a = step.func(initialA);
                             b = step.func(initialB);
                             mappedKey = true;
                           }
                           break;
      }
    } else {
      switch (step.type) {
        case KEYMAPPER:    finished = true;
                           break;
        case RESULTMAPPER: result = step.func(result);
                           break;
      }
    }
  });
  if (result === undefined) getResult();
  return result;
}
function createTargetProxy(type, proxyOptions = {}) {
  return new Proxy({}, {
    get: (obj, prop) => {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'type') return type;
      if (prop === 'configurable') return createTargetProxy(type, { configurable: true });
      return (actions[prop] || {}).func;
    },
    set: (obj, prop, func) => {
      if (prop === 'configurable') throw new Error('Attempting to set a read-only property: ' + prop);
      if (typeof func !== 'function') throw new Error('Attempted to set Comparator function to non-function: ' + func);
      let options = Object.assign({}, proxyOptions);

      if (String(func).includes('return function')) {
        options.configurable = true;
      }
      actions[prop] = Object.assign(options, {
        func: func,
        name: prop,
        type: type,
      });
      return true;
    }
  });
}
function createComparatorProxy(previousPipeline = [], step) {
  let pipeline = step ? previousPipeline.concat(step) : [].concat(previousPipeline);
  return new Proxy( (a, b) => pipelineRunner(pipeline, a, b), {
    get: (obj, prop) => {
      let funcs = functionsPerType[prop];
      if (funcs) return funcs;

      if (prop === Symbol.toStringTag) return step ? String(step.func) : undefined;
      if (prop === Symbol.toPrimitive) return obj;

      let newStep = actions[prop];
      if (!newStep && prop === 'configurable') return functionsPerType[COMPARATOR][prop];
      if (!newStep) throw new Error('Unknown Comparator function requested: ' + String(prop));
      if (newStep.configurable) return (...args) => {
       return createComparatorProxy(pipeline, {
         func: newStep.func.apply({
           pipeline: pipeline.slice(),
           actions: actions,
           createComparatorProxy: createComparatorProxy
         }, args),
         type: newStep.type
       });
      };
      return createComparatorProxy(pipeline, newStep);
    },
    set: (obj, prop, value) => {
      functionsPerType.comparators[prop] = value;
      return true;
    }
  });
}

// Returns a new array where all elements that are arrays are replaced by their elements, recursively
// This was originally written on Array.prototype but there should not be side-effects in this module.
function flatten(array, flattening) {
  if (!(flattening instanceof Set)) flattening = new Set();
  if (flattening.has(array)) return []; // prevent endless recursion
  flattening.add(array);
  let flat = [];
  array.forEach( item => {
    if (Array.isArray(item)) {
      flatten(item, flattening).forEach( fitem => flat.push(fitem) );
    } else {
      flat.push(item);
    }
  });
  return flat;
};
