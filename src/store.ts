import { useEffect, useState } from 'react';
import { Emitter } from './emitter';
import { Signal } from './signal';

const noDataErr = () => {
  throw new Error('missing store data, put init data to "createStore" or set it by "resetStore"');
};

export function createStore<S extends object = Record<string, unknown>>(data?: S) {
  type SetFn<P extends keyof S> = (oldValue: S[P]) => S[P];
  type HookFn<P extends keyof S> = (value: S[P], prop: P) => void;

  let plainData = data as S;
  const emitter = new Emitter();
  const resetSignal = new Signal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hooks = new Map<keyof S, Set<HookFn<any>>>();

  function setProp<P extends keyof S>(prop: P, valueOrSetFn: S[P] | ((oldValue: S[P]) => S[P])) {
    if (!plainData) {
      noDataErr();
    }
    const oldV = plainData[prop];
    const value =
      typeof valueOrSetFn === 'function' ? (valueOrSetFn as SetFn<P>)(oldV) : valueOrSetFn;
    if (oldV === value) return; // ignore if nothing changed
    plainData[prop] = value;
    emitter.emit(prop as string, value);
    const hookFnSet = hooks.get(prop);
    hookFnSet?.forEach((hookFn) => hookFn(value, prop));
  }

  function useStore<P extends keyof S>(propName: P) {
    if (!plainData) {
      noDataErr();
    }

    const [data, setData] = useState(plainData[propName]);

    useEffect(() => {
      function onReset() {
        setData(plainData?.[propName]);
      }
      resetSignal.on(onReset);

      function onUpdate(newValue: S[P]) {
        setData(newValue);
      }
      emitter.on(propName as string, onUpdate);

      return () => {
        resetSignal.off(onReset);
        emitter.off(propName as string, onUpdate);
      };
    }, []);

    return [
      data,
      (v: S[P] | SetFn<P>) => {
        setProp(propName, v);
      },
    ] as [S[P], (v: S[P] | ((oldValue: S[P]) => S[P])) => void];
  }
  function resetStore(data: S) {
    plainData = data;
    resetSignal.emit();
  }
  function getProp<P extends keyof S>(prop: P): S[P] {
    if (!plainData) {
      noDataErr();
    }
    return plainData[prop];
  }

  function hook<P extends keyof S>(prop: P, hookFn: (value: S[P], prop: P) => void) {
    let fnSet = hooks.get(prop);
    if (!fnSet) {
      hooks.set(prop, (fnSet = new Set()));
    }
    fnSet.add(hookFn);
  }

  return {
    /**
     * hook to use property state of current store object, similar to react useState hook.
     * @param propName property of current store object
     * @returns [property value, property update function]
     */
    useStore,
    /**
     * reset whole store object and emit events of every property
     */
    resetStore,
    /**
     * get inner whole store object
     */
    getStore() {
      return plainData as S;
    },
    get: getProp,
    /**
     * update/set property value and emit event
     * @param prop property name of current store object
     * @param value property value to be updated
     * @param forceUpdate force update and emit event even value not changed, default is false
     */
    set: setProp,
    /**
     * add hook function to property when value of this property is updated
     * @param prop property name of current store object
     * @param hookFn hook function to be executed after the property is changed
     */
    hook,
  };
}
