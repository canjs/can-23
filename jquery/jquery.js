var can23 = require("../can-core");
var jQuery = require("jquery");
var assign = require("can-assign");
var canReflect = require("can-reflect");

var $fndata = jQuery.fn.data;
var $data = jQuery.data;
var $fnRemoveData = jQuery.fn.removeData;
var $removeData = jQuery.removeData;
var $trigger = jQuery.fn.trigger

var rtypenamespace = /^([^.]*)(?:\.(.+)|)$/,
  rnothtmlwhite = /[^\x20\t\r\n\f]+/g;

assign(jQuery.fn, {
  viewModel: function(attr, value){
    var args = [this[0]].concat( [].slice.call(arguments, 0 ));
    return can23.viewModel.apply(can23, args);
  },
  trigger :function(event, args) {
    if(jQuery.event.special[event]) {
      $trigger.apply(this, [event].concat(args || []))
    } else {
      this.each(function(_, el) {
        can23.trigger(el, event, args);
      });
    }
    return this;
  },
  data: function() {
    var ret = can23.data.apply(can23, [this].concat([].slice.call(arguments, 0)))
    return arguments.length ? ($fndata.apply(this, arguments) || ret) : Object.assign({}, $fndata.apply(this, arguments), ret);
  },
  removeData: function() {
    can23.removeData.apply(can23, [this].concat([].slice.call(arguments, 0)))
    return $fnRemoveData.apply(this, arguments);
  }
});
canReflect.assignSymbols(jQuery.fn, {
  "can.isMoreListLikeThanMapLike": true
});

assign(jQuery, {
  data: function() {
    var ret = can23.data.apply(can23, arguments);
    return arguments.length > 1 ? ($data.apply(jQuery, arguments) || ret) : Object.assign({}, $data.apply(jQuery, arguments), ret);
  },
  removeData: function() {
    can23.removeData.apply(can23, arguments);
    return $removeData.apply(jQuery, arguments);
  }
});

assign(jQuery.event, {
  add: function( elem, types, handler, data, selector ) {

    var handleObjIn, eventHandle, tmp,
      events, t, handleObj,
      special, handlers, type, namespaces, origType,
      elemData = jQuery._data( elem );  // TODO make later jQuery's private data accessible.

    // Only attach events to objects that accept data
    if ( !jQuery.acceptData( elem ) ) {
      return;
    }

    // Caller can pass in an object of custom data in lieu of the handler
    if ( handler.handler ) {
      handleObjIn = handler;
      handler = handleObjIn.handler;
      selector = handleObjIn.selector;
    }

    // Ensure that invalid selectors throw exceptions at attach time
    // Evaluate against documentElement in case elem is a non-element node (e.g., document)
    if ( selector ) {
      jQuery.find.matchesSelector( document.documentElement, selector );
    }

    // Make sure that the handler has a unique ID, used to find/remove it later
    if ( !handler.guid ) {
      handler.guid = jQuery.guid++;
    }

    // Init the element's event structure and main handler, if this is the first
    if ( !( events = elemData.events ) ) {
      events = elemData.events = Object.create( null );
    }
    if ( !( eventHandle = elemData.handle ) ) {
      eventHandle = elemData.handle = function( e ) {

        // Discard the second event of a jQuery.event.trigger() and
        // when an event is called after a page has unloaded
        var args = [].slice.call(arguments, 0);
        if (args.length < 2 && e.data) {
          args = args.concat(e.data);
        }
        return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
          jQuery.event.dispatch.apply( eventHandle.elem, args ) : undefined;
      };
      eventHandle.elem = elem;
    }

    // Handle multiple events separated by a space
    types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
    t = types.length;
    while ( t-- ) {
      tmp = rtypenamespace.exec( types[ t ] ) || [];
      type = origType = tmp[ 1 ];
      namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

      // There *must* be a type, no attaching namespace-only handlers
      if ( !type ) {
        continue;
      }

      // If event changes its type, use the special event handlers for the changed type
      special = jQuery.event.special[ type ] || {};

      // If selector defined, determine special event api type, otherwise given type
      type = ( selector ? special.delegateType : special.bindType ) || type;

      // Update special based on newly reset type
      special = jQuery.event.special[ type ] || {};

      // handleObj is passed to all event handlers
      handleObj = jQuery.extend( {
        type: type,
        origType: origType,
        data: data,
        handler: handler,
        guid: handler.guid,
        selector: selector,
        needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
        namespace: namespaces.join( "." )
      }, handleObjIn );

      // Init the event handler queue if we're the first
      if ( !( handlers = events[ type ] ) ) {
        handlers = events[ type ] = [];
        handlers.delegateCount = 0;

        // Only use addEventListener if the special events handler returns false
        if ( !special.setup ||
          special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

          if ( elem.addEventListener ) {
            elem.addEventListener( type, eventHandle );
          }
        }
      }

      if ( special.add ) {
        special.add.call( elem, handleObj );

        if ( !handleObj.handler.guid ) {
          handleObj.handler.guid = handler.guid;
        }
      }

      // Add to the element's handler list, delegates in front
      if ( selector ) {
        handlers.splice( handlers.delegateCount++, 0, handleObj );
      } else {
        handlers.push( handleObj );
      }

      jQuery.event.global[ type ] = true;
    }

    // Nullify elem to prevent memory leaks in IE
    elem = null;

  }
});