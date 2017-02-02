import SelectHelperProvider from './kibi_select_helper';
import _ from 'lodash';
import uiModules from 'ui/modules';
import template from './kibi_select.html';

uiModules.get('kibana')
.directive('kibiSelectPort', function (Private) {
  const selectHelper = Private(SelectHelperProvider);

  return {
    require: 'ngModel',
    restrict: 'E',
    replace: true,
    scope: {
      // the id of the kibi-select object
      id: '=?',
      // Filter function which returns true for items to be removed.
      // There are two arguments:
      // - id: the id of the kibi-select
      // - value: the value of the item
      // Since the filter function is called with arguments, a function named "myfunc" should be passed
      // as 'filter="myfunc"'.
      // See http://weblogs.asp.net/dwahlin/creating-custom-angularjs-directives-part-3-isolate-scope-and-function-parameters
      //
      // If the value is **undefined**, the function may return an object that is used in the angular watcher.
      filter: '&?',
      objectType:       '@',  // text
      indexPatternId:   '=?', // optional only for objectType === field | indexPatternType | documentIds
      indexPatternType: '=?', // optional only for objectType === documentIds
      fieldTypes:       '=?', // optional only for objectType === field, value should be array of strings
      queryId:          '=?', // optional only for objectType === queryVariable
      modelDisabled:    '=?', // use to disable the underlying select
      modelRequired:    '=?', // use to disable the underlying select
      include:          '=?', // extra values can be passed here
      analyzedWarning:  '@',  // set to true or false to disable/enable analyzed field warning
      filterable:       '=?' // optional - enable selection filtering
    },
    template,
    link: function (scope, element, attrs, ngModelCtrl) {
      scope.isValid = true;
      scope.required = scope.modelRequired;
      scope.disabled = scope.modelDisabled;
      if (attrs.hasOwnProperty('required')) {
        scope.required = true;
      }
      scope.modelObject = ngModelCtrl.$viewValue; //object
      scope.items = [];

      scope.$watch(
        function () {
          return ngModelCtrl.$modelValue;
        },
        function (newValue) {
          scope.modelObject = ngModelCtrl.$viewValue; //object
        }
      );

      const _setViewValue = function () {
        if (scope.modelObject) {
          ngModelCtrl.$setViewValue(scope.modelObject);
        } else {
          ngModelCtrl.$setViewValue(null);
        }
      };

      scope.$watch('modelDisabled', function () {
        scope.disabled = scope.modelDisabled;
        if (scope.modelDisabled) {
          scope.required = false;
        }
        _setViewValue();
      });

      scope.$watch('modelRequired', function () {
        if (scope.modelRequired !== undefined) {
          scope.required = scope.modelRequired;
          _setViewValue();
        }
      });

      scope.$watch('modelObject', function () {
        _setViewValue();
      }, true);

      ngModelCtrl.$formatters.push(function (modelValue) {
        // here what is passed to a formatter is just a string
        let formatted;
        if (scope.items.length) {
          formatted = _.find(scope.items, function (item) {
            return item.value === modelValue;
          });
        }

        if (!formatted && modelValue) {
          formatted = {
            value: modelValue,
            label: ''
          };
        }
        return formatted;
      });

      ngModelCtrl.$parsers.push(function (viewValue) {
        const ret = viewValue ? viewValue.value : null;
        scope.isValid = scope.required ? !!ret : true;
        ngModelCtrl.$setValidity('stSelect', scope.required ? !!ret : true);
        return ret;
      });

      function autoSelect(items) {
        if (scope.required) {
          return items.length === 2; // first element is the empty one
        }
        return false;
      }

      const _renderSelect = function (items) {
        scope.analyzedField = false;
        scope.items = items;
        if (scope.items) {
          if (scope.include && scope.include.length) {
            // remove elements in items that appear in the extra items
            _.remove(scope.items, function (item) {
              return !!_.find(scope.include, function (extraItem) {
                return item.value === extraItem.value;
              });
            });
            scope.items = scope.include.concat(scope.items);
          }
          // sort by label
          scope.items = _.sortBy(scope.items, 'label');

          if (scope.filter && _.isFunction(scope.filter())) {
            _.remove(scope.items, function (item) {
              const selected = !!ngModelCtrl.$viewValue && !!ngModelCtrl.$viewValue.value &&
                ngModelCtrl.$viewValue.value === item.value;
              const toRemove = scope.filter()(scope.id, item.value);
              return toRemove && !selected;
            });
          }
          // if the select is NOT required, the user is able to choose an empty element
          if (scope.items.length > 0 && _.first(scope.items).value !== null) {
            scope.items.splice(0, 0, {
              label: '',
              value: null
            });
          }
        }

        const item = _.find(scope.items, function (item) {
          return ngModelCtrl.$viewValue && item.value === ngModelCtrl.$viewValue.value;
        });

        if (item && item.options && item.options.analyzed) {
          scope.analyzedField = true;
        } else if (autoSelect(scope.items)) {
          // select automatically if only 1 option is available and the select is required
          scope.modelObject = scope.items[1];
        } else if (scope.items && scope.items.length > 0 && !item) {
          // object saved in the model is not in the list of items
          scope.modelObject = {
            value: '',
            label: ''
          };
        }
      };

      const _render = function () {
        let promise;

        switch (scope.objectType) {
          case 'search':
            promise = selectHelper.getObjects(scope.objectType, scope.itemsFilter);
            break;
          case 'field':
            promise = selectHelper.getFields(scope.indexPatternId, scope.fieldTypes);
            break;
        }

        scope.retrieveError = '';
        if (promise) {
          promise.then(_renderSelect).catch(function (err) {
            scope.retrieveError = _.isEmpty(err) ? '' : err;
            ngModelCtrl.$setValidity('stSelect', false);
          });
        }
      };

      scope.filterItems = function () {
        scope.itemsFilter = this.itemsFilter;
        _render();
      };

      scope.$watchMulti(['indexPatternId', 'indexPatternType', 'queryId', 'include', 'modelDisabled', 'modelRequired'], function () {
        _render();
      });

      scope.$watch(function (scope) {
        if (scope.filter && _.isFunction(scope.filter())) {
          return scope.filter()(scope.id);
        }
      }, function () {
        _render();
      }, true);
      _render();
    }

  };
});
