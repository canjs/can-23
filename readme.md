# Can-23

Upgrade from CanJS 2.X to CanJS 6 easily!

This repo creates a very close approximation of CanJS 2.3's behavior, but uses CanJS 6's technology. This makes
CanJS 2.X code work with CanJS 6. The result is you can incrementally upgrade your legacy CanJS 2.X app to
CanJS 6.  Replace one legacy control or component at a time, while being able to add new features!


## Use

### Step 1

Replace imports of `can` with imports of `can-23`.  For example, replace:

```js
import Control from "can/control/control"
```

With:

```js
import Control from "can-23/control/control"
```

### Step 2

Import `can-23/util/before-remove` before any controls instance get created.


### Step 3

Run migrations to change view-bindings.

### Step: Handle events on controls after teardown

CanJS 2.3 had different event timing than CanJS 6's queues system.

The `can-23/control/noop-event-handlers-on-destroyed` rewrites control event
handlers to check if the control has been destroyed before calling the callback function.

Import it before any Control is instantiated:

```js
import "can-23/control/noop-event-handlers-on-destroyed"
```

This plugin will warn when a control event handler is called after destroy.


### Optional Step: Switch to how CanJS 2.2 passes computes instead of 2.3

CanJS 2.2 would sometimes pass a compute when 2.3 (and 6.0) would pass a value.

To switch to this, set the following:

```js
can.view.Scope._legacyCan22FindingAnObservableOnTheScopeReturnsComputes = true;
```

## Other

- can.Map.prototype.\_legacyAttrBehavior is set to `true`. This means classes are left alone.



## Limitations

### Control

Can 2's `Control`'s `removed` events and `destroy` methods were run before the element was actually removed.

CanJS 6's `removed` events are run asynchronously _after_ the element was actually removed.

The `can-23/util/before-remove` module creates a `beforeRemove` event that acts like Can 2's removed event.

When the `can-23/util/before-remove` is loaded, Can23's `Control` will translate `removed` events to `beforeRemove`
event automatically.  

If you want a Can23 `Control` to use CanJS 6's async removed event, you can specify that as follows:

```js
Control.extend({
  " removed": function(){ ... }
  $useAsyncRemoved: true
})
```

This can be set globally like:

```js
Control.$useAsyncRemoved = true
```

However, the same thing can be done by removing the `before-remove` module.
