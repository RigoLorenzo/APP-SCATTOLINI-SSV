export const PARKING_P2_LAYOUT = {
  name: "P2",
  totalSpots: 162,
  sides: {
    SX: {
      totalSpots: 74,
      rows: {
        3: ["A", "B", "C", "E", "F", "G", "I", "J", "K", "M", "N", "O", "Q", "R", "S", "U", "V", "W", "X"],
        4: ["A", "B", "C", "E", "F", "G", "I", "J", "K", "M", "N", "O", "Q", "R", "S", "U", "V", "W", "X"],
        11: ["A", "B", "C", "D", "F", "G", "I", "K", "L", "N", "O", "Q", "R", "S", "U", "V", "W", "X"],
        12: ["A", "B", "C", "D", "F", "G", "J", "K", "L", "N", "O", "Q", "R", "S", "U", "V", "W", "X"]
      },
      columnBlocks: [
        ["A", "B", "C", "D"],
        ["E", "F", "G"],
        ["I", "J", "K", "L"],
        ["M", "N", "O"],
        ["Q", "R", "S"],
        ["U", "V", "W", "X"]
      ]
    },
    DX: {
      totalSpots: 88,
      rows: {
        3: ["Z", "AA", "AB", "AD", "AE", "AF", "AH", "AI", "AJ", "AL", "AM", "AN", "AP", "AQ", "AR", "AT", "AU", "AV", "AX", "AY", "AZ", "BA"],
        4: ["Z", "AA", "AB", "AD", "AE", "AF", "AH", "AI", "AJ", "AL", "AM", "AN", "AP", "AQ", "AR", "AT", "AU", "AV", "AX", "AY", "AZ", "BA"],
        11: ["Z", "AA", "AB", "AD", "AE", "AF", "AH", "AI", "AJ", "AL", "AM", "AN", "AP", "AQ", "AR", "AT", "AU", "AV", "AX", "AY", "AZ", "BA"],
        12: ["Z", "AA", "AB", "AD", "AE", "AF", "AH", "AI", "AJ", "AL", "AM", "AN", "AP", "AQ", "AR", "AT", "AU", "AV", "AX", "AY", "AZ", "BA"]
      },
      columnBlocks: [
        ["Z", "AA", "AB"],
        ["AD", "AE", "AF"],
        ["AH", "AI", "AJ"],
        ["AL", "AM", "AN"],
        ["AP", "AQ", "AR"],
        ["AT", "AU", "AV"],
        ["AX", "AY", "AZ", "BA"]
      ]
    }
  }
};
