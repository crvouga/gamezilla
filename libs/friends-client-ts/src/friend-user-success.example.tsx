import { createSignal } from 'solid-js';
import {
  FriendUserScreenView,
  type FriendUserScreenViewProps,
} from './friend-user-screen-view';

/** The local relationship updates before the success modal is dismissed. */
export function FriendUserSuccessExample(props: FriendUserScreenViewProps) {
  // Seeded from the story's args, and reseeded when a control changes them.
  const [status, setStatus] = createSignal(() => props.status);
  const [confirming, setConfirming] = createSignal(() => props.confirming);
  const remove = async () => {
    await props.onRemove();
    setStatus('none');
  };
  const block = async () => {
    await props.onBlock();
    setStatus('blocked_by_me');
  };
  return (
    <FriendUserScreenView
      {...props}
      status={status()}
      confirming={confirming()}
      onRemove={remove}
      onBlock={block}
      onCancelConfirm={() => {
        props.onCancelConfirm();
        setConfirming(null);
      }}
    />
  );
}
