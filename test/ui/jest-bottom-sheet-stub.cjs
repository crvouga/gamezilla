/** Passthrough Bottom Sheet surface for Jest (no native reanimated). */
const React = require('react');

function Passthrough(props) {
  return React.createElement(React.Fragment, null, props.children ?? null);
}

const BottomSheetModal = React.forwardRef(
  function BottomSheetModal(props, ref) {
    React.useImperativeHandle(ref, () => ({
      present: () => undefined,
      dismiss: () => undefined,
      close: () => undefined,
      snapToIndex: () => undefined,
      snapToPosition: () => undefined,
      expand: () => undefined,
      collapse: () => undefined,
      forceClose: () => undefined,
    }));
    return React.createElement(Passthrough, props);
  }
);

module.exports = {
  __esModule: true,
  BottomSheet: Passthrough,
  BottomSheetModal,
  BottomSheetModalProvider: Passthrough,
  BottomSheetView: Passthrough,
  BottomSheetScrollView: Passthrough,
  BottomSheetFlatList: Passthrough,
  BottomSheetSectionList: Passthrough,
  BottomSheetTextInput: 'TextInput',
  BottomSheetBackdrop: Passthrough,
  BottomSheetHandle: Passthrough,
  BottomSheetFooter: Passthrough,
  useBottomSheet: () => ({
    close: () => undefined,
    collapse: () => undefined,
    expand: () => undefined,
    snapToIndex: () => undefined,
    snapToPosition: () => undefined,
    forceClose: () => undefined,
  }),
  useBottomSheetModal: () => ({
    dismiss: () => undefined,
    dismissAll: () => undefined,
  }),
  useBottomSheetSpringConfigs: () => ({}),
  useBottomSheetTimingConfigs: () => ({}),
  useBottomSheetInternal: () => ({}),
  useBottomSheetDynamicSnapPoints: () => ({
    animatedSnapPoints: { value: [] },
    animatedHandleHeight: { value: 0 },
    animatedContentHeight: { value: 0 },
    handleContentLayout: () => undefined,
  }),
};
