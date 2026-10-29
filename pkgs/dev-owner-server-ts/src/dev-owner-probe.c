/* macOS ownership-only environment probe; never prints other environment values. */
#include <sys/types.h>
#include <sys/sysctl.h>
#include <libproc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void probe(int pid, char *buffer, size_t capacity) {
    int mib[] = { CTL_KERN, KERN_PROCARGS2, pid };
    size_t size = capacity;
    if (pid <= 1 || sysctl(mib, 3, buffer, &size, NULL, 0) != 0) return;
    if (size < sizeof(int)) return;
    int argc;
    memcpy(&argc, buffer, sizeof(argc));
    if (argc < 0) return;
    char *cursor = buffer + sizeof(argc);
    char *end = buffer + size;
    /* Executable path, padding, then argc argument strings. */
    while (cursor < end && *cursor) cursor++;
    while (cursor < end && !*cursor) cursor++;
    for (int i = 0; i < argc && cursor < end; i++) {
        while (cursor < end && *cursor) cursor++;
        if (cursor < end) cursor++;
    }
    char *root = NULL;
    char *boot = NULL;
    while (cursor < end && *cursor) {
        size_t remaining = (size_t)(end - cursor);
        size_t length = strnlen(cursor, remaining);
        if (length == remaining) break;
        if (strncmp(cursor, "DEV_OWNER_ROOT=", 15) == 0) root = cursor + 15;
        if (strncmp(cursor, "DEV_OWNER_BOOT=", 15) == 0) boot = cursor + 15;
        cursor += length + 1;
    }
    if (root) {
        struct proc_vnodepathinfo info;
        memset(&info, 0, sizeof(info));
        int count = proc_pidinfo(pid, PROC_PIDVNODEPATHINFO, 0, &info, sizeof(info));
        const char *cwd = count == sizeof(info) ? info.pvi_cdir.vip_path : "";
        printf("%d\t%s\t%s\t%s\n", pid, root, boot ? boot : "", cwd);
    }
}

int main(int argc, char **argv) {
    int mib[] = { CTL_KERN, KERN_ARGMAX };
    int capacity = 0;
    size_t size = sizeof(capacity);
    if (sysctl(mib, 2, &capacity, &size, NULL, 0) != 0 || capacity <= 0) return 1;
    char *buffer = malloc((size_t)capacity);
    if (!buffer) return 1;
    for (int i = 1; i < argc; i++) probe(atoi(argv[i]), buffer, (size_t)capacity);
    free(buffer);
    return 0;
}
